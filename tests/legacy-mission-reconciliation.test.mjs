import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const reconciliationSource = await readFile(
  new URL(
    "../src/lib/missions/legacyReconciliation.ts",
    import.meta.url
  ),
  "utf8"
);
const tradeProofSource = await readFile(
  new URL("../src/lib/missions/legacyTradeProof.ts", import.meta.url),
  "utf8"
);
const adminRouteSource = await readFile(
  new URL(
    "../src/app/api/admin/reconcile-legacy-missions/route.ts",
    import.meta.url
  ),
  "utf8"
);
const watchlistRouteSource = await readFile(
  new URL("../src/app/api/watchlist/route.ts", import.meta.url),
  "utf8"
);
const migrationSource = await readFile(
  new URL(
    "../supabase/migrations/20260813163658_expand_verified_missions.sql",
    import.meta.url
  ),
  "utf8"
);

test("legacy coin evidence is restricted to the official Base factory and DrawCoin referrer", () => {
  assert.match(reconciliationSource, /coinFactoryAddress\[base\.id\]/);
  assert.match(reconciliationSource, /getCoinCreateFromLogs/);
  assert.match(reconciliationSource, /deployment\.caller/);
  assert.match(reconciliationSource, /deployment\.platformReferrer/);
  assert.match(reconciliationSource, /DRAWCOIN_PLATFORM_REFERRER/);
  assert.match(reconciliationSource, /getCode\(\{ address: coin \}\)/);
});

test("legacy trades require a verified DrawCoin and bounded canonical proof", () => {
  assert.match(
    reconciliationSource,
    /\.from\("drawcoins"\)[\s\S]*?\.not\("verified_at", "is", null\)/
  );
  assert.match(tradeProofSource, /coinV4ABI/);
  assert.match(tradeProofSource, /strict: true/);
  assert.match(tradeProofSource, /universalRouterAddress\[base\.id\]/);
  assert.match(tradeProofSource, /entryPoint06Address/);
  assert.match(tradeProofSource, /event\.args\.success === true/);
  assert.match(tradeProofSource, /event\.args\.value <= BigInt\(0\)/);
  assert.match(reconciliationSource, /commit_legacy_activity_verification/);
  assert.match(reconciliationSource, /commit_legacy_trade_verification/);
});

test("admin reconciliation defaults to dry-run and requires the server cron secret", () => {
  assert.match(adminRouteSource, /process\.env\.CRON_SECRET/);
  assert.match(adminRouteSource, /timingSafeEqual/);
  assert.match(
    adminRouteSource,
    /export async function GET[\s\S]*?handle\(request, false\)/
  );
  assert.match(
    adminRouteSource,
    /export async function POST[\s\S]*?handle\(request, true\)/
  );
  assert.match(adminRouteSource, /offset: z\.coerce\.number\(\)\.int\(\)\.min\(0\)\.max\(10_000\)/);
  assert.match(reconciliationSource, /\.range\(offset, offset \+ Math\.max\(0, drawcoinLimit - 1\)\)/);
  assert.match(reconciliationSource, /requestedOffset: offset/);
});

test("legacy watchlists only count after explicit SIWE reconfirmation", () => {
  assert.match(
    watchlistRouteSource,
    /export async function PATCH[\s\S]*?requireWalletSession\(\)/
  );
  assert.match(watchlistRouteSource, /reconfirm_legacy_watchlists/);
  assert.match(
    migrationSource,
    /revoke execute on function public\.reconfirm_legacy_watchlists\(text\)[\s\S]*?from public, anon, authenticated/
  );
  assert.match(
    migrationSource,
    /coin\.verified_at is not null/
  );
});

test("database promotion is compare-and-set and proof records are private", () => {
  assert.match(migrationSource, /and verified_at is null/);
  assert.match(migrationSource, /lower\(tx_hash\) = v_normalized_hash/);
  assert.match(
    migrationSource,
    /alter table public\.activity_verifications enable row level security/
  );
  assert.match(
    migrationSource,
    /revoke all on table public\.activity_verifications[\s\S]*?from public, anon, authenticated/
  );
  assert.match(
    migrationSource,
    /revoke execute on function public\.commit_legacy_activity_verification[\s\S]*?from public, anon, authenticated/
  );
});
