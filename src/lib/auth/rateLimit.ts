import "server-only";

import { hashAuthIdentifier } from "./crypto";
import { resolveTrustedClientIdentifier } from "./clientIdentity";

export function getSiweClientHash(request: Request): string {
  const identifier = resolveTrustedClientIdentifier(request.headers, {
    isVercel: process.env.VERCEL === "1",
    trustedProxyHeader: process.env.AUTH_TRUSTED_CLIENT_IP_HEADER,
  });

  return hashAuthIdentifier(`siwe-nonce:${identifier}`);
}
