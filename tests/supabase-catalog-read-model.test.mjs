import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = await Promise.all(
  [
    "../src/app/api/market/route.ts",
    "../src/app/api/explore/route.ts",
    "../src/app/api/most-watchlisted/route.ts",
    "../src/app/api/watchlist/route.ts",
    "../src/components/watchlist/WatchlistPage.tsx",
    "../src/hooks/useWatchlist.ts",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
);

const [
  marketRoute,
  exploreRoute,
  mostWatchlistedRoute,
  watchlistRoute,
  watchlistPage,
  hook,
] = files;

test("render-critical catalog reads never query Zora", () => {
  for (const source of files) {
    assert.doesNotMatch(source, /zoraService|getCoinsBatchWithRetry|getCoinDetails/);
  }

  assert.match(marketRoute, /dbCoins\.map\(toSupabaseCoinSnapshot\)/);
  assert.match(exploreRoute, /mostWatchlisted\.map\(toSupabaseCoinSnapshot\)/);
  assert.match(mostWatchlistedRoute, /rows\.slice\(0, limit\)\.map\(toSupabaseCoinSnapshot\)/);
});

test("watchlist page consumes its authenticated Supabase join without N+1 reads", () => {
  assert.match(watchlistPage, /item\.coin/);
  assert.doesNotMatch(watchlistPage, /CoinService|getCoinByAddress|Promise\.all/);
  assert.match(
    watchlistRoute,
    /coin:drawcoins!watchlists_token_address_fkey\(\$\{COIN_SNAPSHOT_COLUMNS\}\)/,
  );
  assert.match(watchlistRoute, /coin \? toSupabaseCoinSnapshot\(coin\) : null/);
  assert.match(hook, /items\?: WatchlistItem\[\]/);
  assert.doesNotMatch(hook, /getETHPrice|buildPriceSnapshot = async/);
});

test("most-watchlisted pagination requests a lookahead row", () => {
  assert.match(mostWatchlistedRoute, /getMostWatchlisted\(limit \+ 1, offset/);
  assert.match(mostWatchlistedRoute, /const hasMore = rows\.length > limit/);
});
