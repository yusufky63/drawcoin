import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const helper = await readFile(
  new URL("../src/lib/baseBasename.ts", import.meta.url),
  "utf8",
);
const route = await readFile(
  new URL("../src/app/api/basenames/route.ts", import.meta.url),
  "utf8",
);
const clientCache = await readFile(
  new URL("../src/lib/creatorIdentityClient.ts", import.meta.url),
  "utf8",
);
const migration = await readFile(
  new URL(
    "../supabase/migrations/20260814162647_optimize_market_activity_and_creator_identity.sql",
    import.meta.url,
  ),
  "utf8",
);
const catalogMigration = await readFile(
  new URL(
    "../supabase/migrations/20260814164938_persist_creator_basenames_in_catalog.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Base Names resolve through one bounded Base L2 multicall", () => {
  assert.match(helper, /0xC6d566A56A1aFf6508b41f6c90ff131615583BCD/i);
  assert.match(helper, /basePublicClient\.multicall/);
  assert.match(helper, /toCoinType\(base\.id\)/);
  assert.doesNotMatch(route, /getEnsName|getEthereumPublicClient/);
  assert.match(route, /MAX_CREATOR_BASENAME_RPC_BATCH/);
});

test("Base Name results use a private-by-policy Supabase cache", () => {
  assert.match(route, /from\("creator_identity_cache"\)/);
  assert.match(route, /\.upsert\(rows, \{ onConflict: "address" \}\)/);
  assert.match(route, /RESOLVED_CACHE_TTL_MS = 7 \* 24/);
  assert.match(route, /EMPTY_CACHE_TTL_MS = 24 \* 60/);
  assert.match(migration, /alter table public\.creator_identity_cache enable row level security/i);
  assert.match(migration, /revoke all on table public\.creator_identity_cache[\s\S]*?anon, authenticated/i);
  assert.match(migration, /grant select, insert, update, delete[\s\S]*?service_role/i);
});

test("all client surfaces share an address-keyed cache and catalog projection", () => {
  assert.match(clientCache, /clientIdentityCache/);
  assert.match(clientCache, /pendingIdentities/);
  assert.match(clientCache, /resolveCreatorBasenames/);
  assert.match(catalogMigration, /sync_cached_creator_basename/);
  assert.match(catalogMigration, /lower\(creator_address\) = new\.address/i);
  assert.match(catalogMigration, /drawcoins_creator_address_lower_idx/i);
});
