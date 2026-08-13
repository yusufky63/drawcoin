import assert from "node:assert/strict";
import test from "node:test";
import { resolveTrustedClientIdentifier } from "../src/lib/auth/clientIdentity.ts";
import { isWalletSessionChainAllowed } from "../src/lib/auth/chains.ts";

test("ignores spoofable forwarding headers without a trusted proxy", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.10",
    "x-real-ip": "203.0.113.11",
  });

  assert.equal(
    resolveTrustedClientIdentifier(headers, { isVercel: false }),
    "untrusted-proxy"
  );
});

test("uses Vercel's protected client IP header", () => {
  const headers = new Headers({
    "x-vercel-forwarded-for": "2001:db8::1",
    "x-forwarded-for": "203.0.113.20",
  });

  assert.equal(
    resolveTrustedClientIdentifier(headers, { isVercel: true }),
    "ip:2001:db8::1"
  );
});

test("uses only an explicitly supported trusted proxy header", () => {
  const headers = new Headers({ "cf-connecting-ip": "198.51.100.7" });

  assert.equal(
    resolveTrustedClientIdentifier(headers, {
      isVercel: false,
      trustedProxyHeader: "CF-Connecting-IP",
    }),
    "ip:198.51.100.7"
  );

  assert.equal(
    resolveTrustedClientIdentifier(headers, {
      isVercel: false,
      trustedProxyHeader: "x-client-controlled-ip",
    }),
    "untrusted-proxy"
  );
});

test("normalizes ports and rejects malformed addresses", () => {
  assert.equal(
    resolveTrustedClientIdentifier(
      new Headers({ "x-real-ip": "192.0.2.25:443" }),
      { isVercel: false, trustedProxyHeader: "x-real-ip" }
    ),
    "ip:192.0.2.25"
  );

  assert.equal(
    resolveTrustedClientIdentifier(
      new Headers({ "x-real-ip": "not-an-ip" }),
      { isVercel: false, trustedProxyHeader: "x-real-ip" }
    ),
    "untrusted-proxy"
  );
});

test("requires an explicit Sepolia flag in production", () => {
  assert.equal(isWalletSessionChainAllowed(8453, "production"), true);
  assert.equal(isWalletSessionChainAllowed(84532, "production"), false);
  assert.equal(isWalletSessionChainAllowed(84532, "development"), true);
  assert.equal(
    isWalletSessionChainAllowed(84532, "production", "true"),
    true
  );
  assert.equal(
    isWalletSessionChainAllowed(84532, "development", "false"),
    false
  );
  assert.equal(isWalletSessionChainAllowed(1, "development"), false);
});
