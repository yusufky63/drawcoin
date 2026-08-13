import { NextRequest, NextResponse } from "next/server";
import {
  createSiweNonce,
  NonceIssuanceError,
  SIWE_NONCE_COOKIE_NAME,
  SIWE_NONCE_TTL_SECONDS,
} from "@/lib/auth/nonce";
import { getSiweClientHash } from "@/lib/auth/rateLimit";

export async function GET(request: NextRequest) {
  let nonce: string;
  let sealedState: string;

  try {
    const clientHash = getSiweClientHash(request);
    ({ nonce, sealedState } = await createSiweNonce(clientHash));
  } catch (error) {
    const issuanceError =
      error instanceof NonceIssuanceError ? error : null;
    const status = issuanceError?.status ?? 503;
    const retryAfter = issuanceError?.retryAfterSeconds ?? 5;

    return NextResponse.json(
      {
        error:
          status === 429
            ? "Too many wallet sign-in requests. Try again shortly."
            : "Wallet sign-in is temporarily unavailable.",
      },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  const response = NextResponse.json({ nonce });

  response.cookies.set(SIWE_NONCE_COOKIE_NAME, sealedState, {
    httpOnly: true,
    maxAge: SIWE_NONCE_TTL_SECONDS,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  response.headers.set("Cache-Control", "no-store");

  return response;
}
