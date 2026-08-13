import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sealAuthPayload, unsealAuthPayload } from "./crypto";

export const SIWE_NONCE_COOKIE_NAME = "drawcoin.siwe_nonce";
export const SIWE_NONCE_TTL_SECONDS = 5 * 60;

type SiweNonceState = {
  kind: "siwe_nonce";
  nonceHash: string;
  expiresAt: number;
};

export type NonceIssuanceReason =
  | "active_limit"
  | "busy"
  | "global_capacity"
  | "rate_limited"
  | "unavailable";

export class NonceIssuanceError extends Error {
  constructor(
    readonly reason: NonceIssuanceReason,
    readonly status: 429 | 503,
    readonly retryAfterSeconds: number
  ) {
    super("Unable to issue a SIWE nonce.");
    this.name = "NonceIssuanceError";
  }
}

function hashNonce(nonce: string): string {
  return createHash("sha256").update(nonce, "utf8").digest("hex");
}

function boundedRetryAfter(value: number | undefined): number {
  if (!Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(600, Math.ceil(value ?? 5)));
}

export async function createSiweNonce(clientHash: string): Promise<{
  nonce: string;
  sealedState: string;
}> {
  if (!/^[0-9a-f]{64}$/.test(clientHash)) {
    throw new NonceIssuanceError("unavailable", 503, 5);
  }

  const nonce = randomBytes(16).toString("hex");
  const nonceHash = hashNonce(nonce);
  const expiresAt = Math.floor(Date.now() / 1000) + SIWE_NONCE_TTL_SECONDS;
  const { data, error } = await supabaseAdmin.rpc("issue_siwe_nonce", {
    p_nonce_hash: nonceHash,
    p_client_hash: clientHash,
    p_expires_at: new Date(expiresAt * 1000).toISOString(),
  });

  if (error || !data?.[0]) {
    throw new NonceIssuanceError("unavailable", 503, 5);
  }

  const result = data[0];
  if (!result.allowed) {
    const reason: NonceIssuanceReason =
      result.reason === "active_limit" ||
      result.reason === "busy" ||
      result.reason === "global_capacity" ||
      result.reason === "rate_limited"
        ? result.reason
        : "unavailable";
    const status =
      reason === "active_limit" || reason === "rate_limited" ? 429 : 503;

    throw new NonceIssuanceError(
      reason,
      status,
      boundedRetryAfter(result.retry_after_seconds)
    );
  }

  const state: SiweNonceState = {
    kind: "siwe_nonce",
    nonceHash,
    expiresAt,
  };

  return { nonce, sealedState: sealAuthPayload(state) };
}

export function validateSiweNonceState(
  sealedState: string | undefined,
  nonce: string
): string | null {
  if (!sealedState) return null;

  const state = unsealAuthPayload<Partial<SiweNonceState>>(sealedState);
  const calculatedHash = hashNonce(nonce);
  const storedHash = state?.nonceHash;
  const calculatedBuffer = Buffer.from(calculatedHash, "hex");
  const storedBuffer =
    typeof storedHash === "string" ? Buffer.from(storedHash, "hex") : null;
  const now = Math.floor(Date.now() / 1000);

  if (
    state?.kind !== "siwe_nonce" ||
    typeof state.expiresAt !== "number" ||
    state.expiresAt <= now ||
    !storedBuffer ||
    storedBuffer.length !== calculatedBuffer.length ||
    !timingSafeEqual(storedBuffer, calculatedBuffer)
  ) {
    return null;
  }

  return calculatedHash;
}

export async function consumeSiweNonce(nonceHash: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("siwe_nonces")
    .delete()
    .eq("nonce_hash", nonceHash)
    .gt("expires_at", new Date().toISOString())
    .select("nonce_hash")
    .maybeSingle();

  if (error) {
    throw new Error("Unable to consume the SIWE nonce.");
  }

  return data?.nonce_hash === nonceHash;
}
