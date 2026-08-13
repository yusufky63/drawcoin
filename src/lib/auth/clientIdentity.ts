import { isIP } from "node:net";

export type ClientIdentityOptions = {
  isVercel: boolean;
  trustedProxyHeader?: string;
};

const SUPPORTED_PROXY_HEADERS = new Set([
  "cf-connecting-ip",
  "x-forwarded-for",
  "x-real-ip",
]);

function firstForwardedValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",", 1)[0]?.trim();
  return first || null;
}

function normalizeIp(value: string | null): string | null {
  const forwarded = firstForwardedValue(value);
  if (!forwarded) return null;

  let candidate = forwarded;

  const bracketedIpv6 = candidate.match(/^\[([^\]]+)](?::\d+)?$/);
  if (bracketedIpv6) {
    candidate = bracketedIpv6[1];
  } else {
    const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
    if (ipv4WithPort) candidate = ipv4WithPort[1];
  }

  return isIP(candidate) === 0 ? null : candidate.toLowerCase();
}

export function resolveTrustedClientIdentifier(
  headers: Headers,
  options: ClientIdentityOptions
): string {
  let rawIp: string | null = null;

  if (options.isVercel) {
    // Vercel overwrites these headers at its trusted edge to prevent spoofing.
    rawIp =
      headers.get("x-vercel-forwarded-for") ??
      headers.get("x-forwarded-for");
  } else if (options.trustedProxyHeader) {
    const headerName = options.trustedProxyHeader.trim().toLowerCase();
    if (SUPPORTED_PROXY_HEADERS.has(headerName)) {
      rawIp = headers.get(headerName);
    }
  }

  const normalizedIp = normalizeIp(rawIp);

  // Without an explicitly trusted proxy, use one shared restrictive bucket.
  // Never trust a caller-controlled forwarding header by default.
  return normalizedIp ? `ip:${normalizedIp}` : "untrusted-proxy";
}
