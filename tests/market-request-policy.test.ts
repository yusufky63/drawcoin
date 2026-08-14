import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMarketMeta,
  buildPostgrestCoinSearchFilter,
  mapWithConcurrency,
  MarketQueryError,
  normalizeWatchlistCounts,
  parseMarketQuery,
} from "../src/lib/market/requestPolicy.ts";

function parse(query = "") {
  return parseMarketQuery(new URL(`https://drawcoin.app/api/market${query}`).searchParams);
}

function assertInvalid(query: string) {
  assert.throws(() => parse(query), MarketQueryError);
}

test("market query defaults and supported filters are bounded", () => {
  assert.deepEqual(parse(), {
    activity: "",
    creationType: "",
    limit: 100,
    page: 1,
    search: "",
    sort: "newest",
  });
  assert.deepEqual(
    parse("?page=2&limit=25&search=%20Base%20Art%20&sort=recently-traded&creationType=hand-drawn&activity=traded"),
    {
      activity: "traded",
      creationType: "hand-drawn",
      limit: 25,
      page: 2,
      search: "Base Art",
      sort: "recently-traded",
    }
  );
  assert.equal(parse("?sort=most-watched").sort, "most-watched");
  assert.equal(parse("?sort=market-cap").sort, "market-cap");
  assert.equal(parse("?sort=most-traded").sort, "most-traded");
  assert.equal(parse("?sort=most-holders").sort, "most-holders");
  assert.equal(parse("?sort=volume-high").sort, "volume-high");
});

test("market query rejects amplification and cache-key inputs", () => {
  for (const query of [
    "?limit=all",
    "?limit=101",
    "?limit=0",
    "?page=0",
    "?page=1001",
    "?page=1x",
    "?sort=random",
    "?sort=price-high",
    "?sort=price-low",
    "?sort=holders-high",
    "?activity=active",
    "?minHolders=5",
    "?creationType=generated",
    "?limit=10&limit=20",
    "?tracking=random",
    `?search=${"a".repeat(101)}`,
  ]) {
    assertInvalid(query);
  }
});

test("PostgREST search values are quoted and metacharacters are escaped", () => {
  assert.equal(
    buildPostgrestCoinSearchFilter("Base Art"),
    'name.ilike."%Base Art%",symbol.ilike."%Base Art%",description.ilike."%Base Art%",creator_name.ilike."%Base Art%",creator_address.ilike."%Base Art%"'
  );

  const filter = buildPostgrestCoinSearchFilter('x"),symbol.ilike.*_%');
  assert.equal(
    filter,
    'name.ilike."%x\\"),symbol.ilike.\\*\\_\\%%",symbol.ilike."%x\\"),symbol.ilike.\\*\\_\\%%",description.ilike."%x\\"),symbol.ilike.\\*\\_\\%%",creator_name.ilike."%x\\"),symbol.ilike.\\*\\_\\%%",creator_address.ilike."%x\\"),symbol.ilike.\\*\\_\\%%"'
  );
});

test("market search can include a coin contract address", () => {
  assert.equal(
    buildPostgrestCoinSearchFilter("0xAbCd", true),
    'name.ilike."%0xAbCd%",symbol.ilike."%0xAbCd%",description.ilike."%0xAbCd%",creator_name.ilike."%0xAbCd%",creator_address.ilike."%0xAbCd%",contract_address.ilike."%0xAbCd%"'
  );
});

test("filtered market metadata keeps the exact total and page count", () => {
  assert.deepEqual(buildMarketMeta(28, 24, 1), {
    limit: 24,
    page: 1,
    total: 28,
    totalPages: 2,
  });
  assert.deepEqual(buildMarketMeta(0, 24, 3), {
    limit: 24,
    page: 3,
    total: 0,
    totalPages: 0,
  });
});

test("watchlist RPC rows map mixed-case addresses to lowercase response keys", () => {
  const lower = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
  const mixed = "0xAbCdEfAbCdEfAbCdEfAbCdEfAbCdEfAbCdEfAbCd";
  const missing = "0x1111111111111111111111111111111111111111";

  assert.deepEqual(
    normalizeWatchlistCounts([lower, missing], [
      { token_address: mixed, watchlist_count: "12" },
    ]),
    { [lower]: 12, [missing]: 0 }
  );
});

test("bounded worker pool never exceeds configured concurrency", async () => {
  let active = 0;
  let maximumActive = 0;
  const values = Array.from({ length: 12 }, (_, index) => index);

  const results = await mapWithConcurrency(values, 3, async (value) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return value * 2;
  });

  assert.equal(maximumActive, 3);
  assert.deepEqual(results, values.map((value) => value * 2));
});

test("an aborted worker pool does not schedule the remaining batches", async () => {
  const controller = new AbortController();
  let started = 0;

  await assert.rejects(
    mapWithConcurrency(
      [0, 1, 2, 3, 4],
      2,
      async () => {
        started += 1;
        controller.abort(new Error("deadline reached"));
      },
      controller.signal
    ),
    /deadline reached/
  );
  assert.equal(started, 1);
});
