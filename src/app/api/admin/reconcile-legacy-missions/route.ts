import { createHash, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { z } from "zod";

import {
  reconcileLegacyMissionActivity,
  type LegacyReconciliationScope,
} from "@/lib/missions/legacyReconciliation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const querySchema = z.object({
  scope: z.enum(["drawcoins", "transactions", "all"]).default("all"),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  address: z
    .string()
    .refine((value) => isAddress(value, { strict: false }))
    .optional(),
});

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;

  const supplied = authorization.slice("Bearer ".length);
  const expectedDigest = createHash("sha256").update(secret).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}

function parseInput(request: NextRequest): {
  scope: LegacyReconciliationScope;
  limit: number;
  offset: number;
  address?: `0x${string}`;
} {
  const url = new URL(request.url);
  const parsed = querySchema.parse({
    scope: url.searchParams.get("scope") || undefined,
    limit: url.searchParams.get("limit") || undefined,
    offset: url.searchParams.get("offset") || undefined,
    address: url.searchParams.get("address") || undefined,
  });

  return {
    scope: parsed.scope,
    limit: parsed.limit,
    offset: parsed.offset,
    ...(parsed.address
      ? { address: getAddress(parsed.address).toLowerCase() as `0x${string}` }
      : {}),
  };
}

async function handle(request: NextRequest, apply: boolean) {
  if (!process.env.CRON_SECRET?.trim()) {
    return response({ error: "Legacy reconciliation is not configured." }, 503);
  }
  if (!isAuthorized(request)) {
    return response({ error: "Unauthorized" }, 401);
  }

  let input: ReturnType<typeof parseInput>;
  try {
    input = parseInput(request);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response({ error: "Invalid reconciliation request." }, 400);
    }
    throw error;
  }

  try {
    const report = await reconcileLegacyMissionActivity({ ...input, apply });
    return response(report);
  } catch (error) {
    console.error("Legacy mission reconciliation failed", error);
    return response(
      {
        error: "Legacy reconciliation is temporarily unavailable.",
        retryable: true,
      },
      503
    );
  }
}

/**
 * Read-only evidence check. It fetches Base receipts but never writes state.
 */
export async function GET(request: NextRequest) {
  return handle(request, false);
}

/**
 * Applies only canonical evidence and then evaluates affected wallets. Replays
 * are idempotent because each database promotion is compare-and-set.
 */
export async function POST(request: NextRequest) {
  return handle(request, true);
}
