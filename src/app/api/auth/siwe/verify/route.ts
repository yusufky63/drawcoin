import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  type Hex,
} from "viem";
import { parseSiweMessage } from "viem/siwe";
import { base, baseSepolia } from "viem/chains";
import {
  consumeSiweNonce,
  SIWE_NONCE_COOKIE_NAME,
  validateSiweNonceState,
} from "@/lib/auth/nonce";
import { createWalletSession } from "@/lib/auth/session";
import { isWalletSessionChainAllowed } from "@/lib/auth/chains";
import { runSiweVerificationAttempt } from "@/lib/auth/siweVerification";

const verifyRequestSchema = z.object({
  address: z.string().max(42),
  message: z.string().min(1).max(8_192),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/).max(32_768),
});

const basePublicClient = createPublicClient({
  chain: base,
  transport: http(
    process.env.BASE_RPC_URL ?? process.env.NEXT_PUBLIC_BASE_RPC_URL
  ),
});

const baseSepoliaPublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(
    process.env.BASE_SEPOLIA_RPC_URL ??
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL
  ),
});

function expectedOrigin(request: NextRequest): URL {
  const configuredOrigin =
    process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  return new URL(configuredOrigin ?? request.nextUrl.origin);
}

function errorResponse(message: string, status: number) {
  const response = NextResponse.json({ error: message }, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const sealedNonce = cookieStore.get(SIWE_NONCE_COOKIE_NAME)?.value;

  // Consume the nonce on every verification attempt.
  cookieStore.delete(SIWE_NONCE_COOKIE_NAME);

  let body: z.infer<typeof verifyRequestSchema>;
  try {
    body = verifyRequestSchema.parse(await request.json());
  } catch {
    return errorResponse("Invalid sign-in request.", 400);
  }

  if (!isAddress(body.address)) {
    return errorResponse("Invalid wallet address.", 400);
  }

  let message: ReturnType<typeof parseSiweMessage>;
  try {
    message = parseSiweMessage(body.message);
  } catch {
    return errorResponse("Invalid SIWE message.", 400);
  }

  if (
    !message.address ||
    !message.domain ||
    !isAddress(message.address) ||
    !message.nonce ||
    !message.uri ||
    message.version !== "1" ||
    typeof message.chainId !== "number" ||
    !isWalletSessionChainAllowed(message.chainId)
  ) {
    return errorResponse("Incomplete or unsupported SIWE message.", 400);
  }

  const address = getAddress(body.address);
  if (getAddress(message.address) !== address) {
    return errorResponse("SIWE address does not match the wallet.", 400);
  }

  const origin = expectedOrigin(request);
  let messageOrigin: string;
  try {
    messageOrigin = new URL(message.uri).origin;
  } catch {
    return errorResponse("Invalid SIWE URI.", 400);
  }

  if (message.domain !== origin.host || messageOrigin !== origin.origin) {
    return errorResponse("SIWE domain does not match this application.", 401);
  }

  const now = new Date();
  const maximumAgeMilliseconds = 10 * 60 * 1000;
  if (
    !message.issuedAt ||
    message.issuedAt.getTime() > now.getTime() + 60_000 ||
    now.getTime() - message.issuedAt.getTime() > maximumAgeMilliseconds
  ) {
    return errorResponse("SIWE message is not fresh.", 401);
  }

  const nonceHash = validateSiweNonceState(sealedNonce, message.nonce);
  if (!nonceHash) {
    return errorResponse("SIWE nonce is invalid, expired, or already used.", 401);
  }

  let verificationResult:
    | "nonce_rejected"
    | "signature_invalid"
    | "verified";
  try {
    const publicClient =
      message.chainId === base.id ? basePublicClient : baseSepoliaPublicClient;
    verificationResult = await runSiweVerificationAttempt({
      nonceHash,
      consumeNonce: consumeSiweNonce,
      verifySignature: () =>
        publicClient.verifySiweMessage({
          address,
          domain: origin.host,
          message: body.message,
          nonce: message.nonce,
          signature: body.signature as Hex,
          time: now,
        }),
    });
  } catch {
    // A nonce-store failure must never fall through to signature verification.
    return errorResponse("Wallet sign-in is temporarily unavailable.", 503);
  }

  if (verificationResult === "nonce_rejected") {
    return errorResponse("SIWE nonce is invalid, expired, or already used.", 401);
  }

  if (verificationResult === "signature_invalid") {
    return errorResponse("Wallet signature is invalid.", 401);
  }

  const session = await createWalletSession(address, message.chainId);
  const response = NextResponse.json({ session });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
