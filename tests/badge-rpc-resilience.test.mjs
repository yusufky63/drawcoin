import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("mission reads fail soft and batch badge contract state", async () => {
  const [chainReads, reconciliation, missionsPage] = await Promise.all([
    readFile(new URL("src/lib/badges/chainReads.ts", root), "utf8"),
    readFile(new URL("src/lib/badges/reconciliation.ts", root), "utf8"),
    readFile(new URL("src/components/missions/MissionsPage.tsx", root), "utf8"),
  ]);

  assert.match(chainReads, /publicClient\.multicall/);
  assert.doesNotMatch(reconciliation, /Promise\.all\([\s\S]*?readClaimed/);
  assert.match(reconciliation, /return snapshot;/);
  assert.doesNotMatch(missionsPage, /older item/);
  assert.doesNotMatch(missionsPage, /waiting for\s+confirmation/);
});

test("temporary badge RPC failures return retryable 503 responses", async () => {
  const [voucherRoute, statusRoute, config] = await Promise.all([
    readFile(
      new URL("src/app/api/badges/claim-voucher/route.ts", root),
      "utf8"
    ),
    readFile(new URL("src/app/api/badges/status/route.ts", root), "utf8"),
    readFile(new URL("src/lib/badges/config.ts", root), "utf8"),
  ]);

  for (const source of [voucherRoute, statusRoute]) {
    assert.match(source, /BadgeRpcUnavailableError/);
    assert.match(source, /"Retry-After": "3"/);
    assert.match(source, /status: 503/);
  }

  assert.match(config, /BADGE_RPC_FALLBACK_URL/);
  assert.match(config, /fallback\(/);
  assert.match(config, /rank: false/);
});
