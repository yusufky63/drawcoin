import assert from "node:assert/strict";
import test from "node:test";

import { toSupabaseCoinSnapshot } from "../src/lib/market/coinSnapshot.ts";

const baseCoin = {
  name: "Canvas",
  symbol: "CANVAS",
  contract_address: "0x1111111111111111111111111111111111111111",
};

test("snapshot derives market cap only from valid persisted price and supply", () => {
  const token = toSupabaseCoinSnapshot({
    ...baseCoin,
    current_price: 2.5,
    total_supply: 1_000,
    volume_24h: 0,
    holders: 0,
    last_synced_at: "2026-08-13T12:00:00.000Z",
  });

  assert.equal(token.dataSource, "supabase");
  assert.equal(token.marketCap, 2_500);
  assert.equal(token.market_cap, 2_500);
  assert.deepEqual(token.tokenPrice, { priceInUsd: 2.5 });
  assert.equal(token.volume24h, 0);
  assert.equal(token.uniqueHolders, 0);
  assert.equal(token.metricsUpdatedAt, "2026-08-13T12:00:00.000Z");
});

test("snapshot leaves unavailable market metrics absent", () => {
  const token = toSupabaseCoinSnapshot({
    ...baseCoin,
    current_price: 0,
    total_supply: 1_000,
    last_synced_at: "not-a-date",
  });

  assert.equal(token.marketCap, undefined);
  assert.equal(token.market_cap, undefined);
  assert.equal(token.tokenPrice, undefined);
  assert.equal(token.marketCapDelta24h, undefined);
  assert.equal(token.price_change_24h, undefined);
  assert.equal(token.metricsUpdatedAt, null);
});

test("snapshot uses the persisted market-cap sort key when available", () => {
  const token = toSupabaseCoinSnapshot({
    ...baseCoin,
    current_price: 2,
    total_supply: 1_000,
    market_cap: 2_000,
  });

  assert.equal(token.marketCap, 2_000);
  assert.equal(token.market_cap, 2_000);
});
