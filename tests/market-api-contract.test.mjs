import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const marketRouteSource = await readFile(
  new URL("../src/app/api/market/route.ts", import.meta.url),
  "utf8",
);
const statsRouteSource = await readFile(
  new URL("../src/app/api/market/stats/route.ts", import.meta.url),
  "utf8",
);
const coinServiceSource = await readFile(
  new URL("../src/services/coinService.ts", import.meta.url),
  "utf8",
);

test("market rows and exact totals share search and creation filters", () => {
  assert.match(marketRouteSource, /activity,/);
  assert.match(marketRouteSource, /min_holders: minHolders/);
  assert.match(marketRouteSource, /creation_type: creationType/);
  assert.match(
    marketRouteSource,
    /getCoinsPage\(\s*\{ \.\.\.filters, limit, offset, sort \}/,
  );
  assert.match(marketRouteSource, /buildMarketMeta\(total, limit, page\)/);
  assert.match(
    marketRouteSource,
    /if \(total === 0 \|\| offset >= total\)/,
  );
});

test("market activity sorts use persisted indexed summary fields", () => {
  for (const [sort, field] of [
    ["recently-traded", "last_trade_at"],
    ["most-traded", "verified_trade_count"],
    ["most-holders", "holders"],
    ["volume-high", "volume_24h"],
  ]) {
    const blocks = coinServiceSource.match(
      new RegExp(`case "${sort}":[\\s\\S]*?break;`, "g"),
    );
    assert.equal(blocks?.length, 2, `${sort} must cover list and page queries`);
    for (const block of blocks ?? []) assert.match(block, new RegExp(field));
  }
  assert.match(coinServiceSource, /gt\("verified_trade_count", 0\)/);
  assert.match(coinServiceSource, /gte\("holders", params(?:\?)?\.min_holders\)/);
});

test("market row and count searches both include contract addresses", () => {
  const contractSearches = coinServiceSource.match(
    /buildPostgrestCoinSearchFilter\(params\.search, true\)/g,
  );
  assert.equal(contractSearches?.length, 4);
});

test("out-of-range PostgREST pages recover their exact filtered total", () => {
  assert.match(
    coinServiceSource,
    /getTotalCoinsCount\(params,\s*\{\s*throwOnError: true/,
  );
  assert.match(
    coinServiceSource,
    /if \(offset >= total\) return \{ coins: \[\], total \}/,
  );
});

test("all market results use the canonical Supabase snapshot path", () => {
  assert.doesNotMatch(marketRouteSource, /if \(search\)/);
  assert.doesNotMatch(marketRouteSource, /zoraService|getCoinsBatchWithRetry/);

  const databaseIndex = marketRouteSource.indexOf(
    "CoinService.getCoinsPage(",
  );
  const snapshotIndex = marketRouteSource.indexOf(
    "dbCoins.map(toSupabaseCoinSnapshot)",
  );

  assert.ok(databaseIndex >= 0, "database page query is missing");
  assert.ok(
    snapshotIndex > databaseIndex,
    "all page results must enter the Supabase snapshot mapper",
  );
});

test("most-watched has deterministic database tie-breakers", () => {
  const sortBlock = coinServiceSource.match(
    /case "most-watched":[\s\S]*?break;/,
  )?.[0];
  assert.ok(sortBlock, "most-watched sort is missing");

  const watchlistIndex = sortBlock.indexOf('.order("watchlist_count"');
  const createdIndex = sortBlock.indexOf('.order("created_at"');
  const idIndex = sortBlock.indexOf('.order("id"');
  assert.ok(watchlistIndex >= 0);
  assert.ok(createdIndex > watchlistIndex);
  assert.ok(idIndex > createdIndex);
});

test("market-cap ordering is global, persisted, and deterministic", () => {
  const sortBlocks = coinServiceSource.match(
    /case "market-cap":[\s\S]*?break;/g,
  );
  assert.equal(sortBlocks?.length, 2);

  for (const sortBlock of sortBlocks ?? []) {
    const marketCapIndex = sortBlock.indexOf('.order("market_cap"');
    const createdIndex = sortBlock.indexOf('.order("created_at"');
    const idIndex = sortBlock.indexOf('.order("id"');
    assert.ok(marketCapIndex >= 0);
    assert.ok(createdIndex > marketCapIndex);
    assert.ok(idIndex > createdIndex);
  }
});

test("market stats uses the mixed-case aggregate RPC and never scans watchlists", () => {
  assert.match(
    statsRouteSource,
    /rpc\("get_watchlist_counts", \{\s*p_addresses: tokens/,
  );
  assert.match(statsRouteSource, /normalizeWatchlistCounts\(tokens, data\)/);
  assert.doesNotMatch(statsRouteSource, /\.from\("watchlists"\)/);
});
