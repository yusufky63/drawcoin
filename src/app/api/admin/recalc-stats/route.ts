import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { mapWithConcurrency } from "@/lib/market/requestPolicy";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 1_000;
const MAX_ROWS = 100_000;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;

  const provided = authorization.slice("Bearer ".length);
  const expectedDigest = createHash("sha256").update(secret).digest();
  const providedDigest = createHash("sha256").update(provided).digest();
  return timingSafeEqual(expectedDigest, providedDigest);
}

async function readAllWatchlistAddresses() {
  const addresses: string[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("watchlists")
      .select("token_address")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;

    const page = data ?? [];
    for (const row of page) {
      if (row.token_address) addresses.push(row.token_address.toLowerCase());
    }
    if (page.length < PAGE_SIZE) return addresses;
  }
  throw new Error("The watchlist table exceeds the safe recalculation limit.");
}

async function readAllCoins() {
  const coins: Array<{ contract_address: string }> = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("drawcoins")
      .select("contract_address")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;

    const page = data ?? [];
    coins.push(...page.filter((row) => Boolean(row.contract_address)));
    if (page.length < PAGE_SIZE) return coins;
  }
  throw new Error("The coin table exceeds the safe recalculation limit.");
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Recalculation is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const [watchlistAddresses, coins] = await Promise.all([
      readAllWatchlistAddresses(),
      readAllCoins(),
    ]);
    const counts = new Map<string, number>();
    for (const address of watchlistAddresses) {
      counts.set(address, (counts.get(address) ?? 0) + 1);
    }

    await mapWithConcurrency(coins, 4, async (coin) => {
      const watchlistCount = counts.get(coin.contract_address.toLowerCase()) ?? 0;
      const { error } = await supabaseAdmin
        .from("drawcoins")
        .update({ watchlist_count: watchlistCount })
        .eq("contract_address", coin.contract_address);
      if (error) throw error;
    });

    return NextResponse.json(
      {
        message: "Recalculation complete",
        updated: coins.length,
        watchedTokens: counts.size,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Watchlist count recalculation failed:", error);
    return NextResponse.json(
      { error: "Recalculation is temporarily unavailable.", retryable: true },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "30" },
      }
    );
  }
}
