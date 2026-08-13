import "server-only";

import { cookies } from "next/headers";
import { getAddress, isAddress } from "viem";
import { isWalletSessionChainAllowed } from "./chains";
import { sealAuthPayload, unsealAuthPayload } from "./crypto";

export const WALLET_SESSION_COOKIE_NAME = "drawcoin.wallet_session";
const WALLET_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export type WalletSession = {
  address: `0x${string}`;
  chainId: number;
  issuedAt: number;
  expiresAt: number;
};

type WalletSessionPayload = WalletSession & {
  kind: "wallet_session";
};

export type SessionErrorCode =
  | "MISSING_SESSION"
  | "INVALID_SESSION"
  | "EXPIRED_SESSION";

export class SessionError extends Error {
  readonly status = 401;

  constructor(readonly code: SessionErrorCode, message: string) {
    super(message);
    this.name = "SessionError";
  }
}

function decodeWalletSession(sealed: string): WalletSession {
  const payload = unsealAuthPayload<Partial<WalletSessionPayload>>(sealed);

  if (
    payload?.kind !== "wallet_session" ||
    typeof payload.address !== "string" ||
    !isAddress(payload.address) ||
    typeof payload.chainId !== "number" ||
    !isWalletSessionChainAllowed(payload.chainId) ||
    typeof payload.issuedAt !== "number" ||
    typeof payload.expiresAt !== "number"
  ) {
    throw new SessionError("INVALID_SESSION", "Wallet session is invalid.");
  }

  if (payload.expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new SessionError("EXPIRED_SESSION", "Wallet session has expired.");
  }

  return {
    address: getAddress(payload.address),
    chainId: payload.chainId,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
}

export async function createWalletSession(
  address: `0x${string}`,
  chainId: number
): Promise<WalletSession> {
  if (!isWalletSessionChainAllowed(chainId)) {
    throw new SessionError(
      "INVALID_SESSION",
      "This Base network is not allowed for wallet sessions."
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const session: WalletSession = {
    address: getAddress(address),
    chainId,
    issuedAt: now,
    expiresAt: now + WALLET_SESSION_TTL_SECONDS,
  };
  const payload: WalletSessionPayload = {
    kind: "wallet_session",
    ...session,
  };
  const cookieStore = await cookies();

  cookieStore.set(WALLET_SESSION_COOKIE_NAME, sealAuthPayload(payload), {
    httpOnly: true,
    maxAge: WALLET_SESSION_TTL_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return session;
}

export async function getWalletSession(): Promise<WalletSession | null> {
  const cookieStore = await cookies();
  const sealed = cookieStore.get(WALLET_SESSION_COOKIE_NAME)?.value;

  if (!sealed) return null;
  return decodeWalletSession(sealed);
}

export async function requireWalletSession(): Promise<WalletSession> {
  const session = await getWalletSession();

  if (!session) {
    throw new SessionError("MISSING_SESSION", "Wallet sign-in is required.");
  }

  return session;
}

export async function clearWalletSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(WALLET_SESSION_COOKIE_NAME);
}
