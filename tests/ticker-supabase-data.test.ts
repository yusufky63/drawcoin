import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTickerTokens,
  derivePersistedMarketCapUsd,
  type TickerCoinSnapshotRow,
  type TickerTransactionRow,
} from "../src/lib/market/tickerDto.ts";

const ADDRESS_A = `0x${"a".repeat(40)}`;
const ADDRESS_B = `0x${"b".repeat(40)}`;

function coin(
  address: string,
  overrides: Partial<TickerCoinSnapshotRow> = {}
): TickerCoinSnapshotRow {
  return {
    contract_address: address,
    name: "Canvas Coin",
    symbol: "CANVAS",
    image_url: "https://example.com/canvas.png",
    current_price: "0.0000025",
    total_supply: "1000000000",
    holders: 3,
    last_synced_at: "2026-08-13T08:00:00.000Z",
    ...overrides,
  };
}

test("market cap is derived only from complete persisted Supabase values", () => {
  assert.equal(derivePersistedMarketCapUsd("0.0000025", "1000000000"), 2500);
  assert.equal(derivePersistedMarketCapUsd("0", "1000000000"), null);
  assert.equal(derivePersistedMarketCapUsd("0.1", "0"), null);
  assert.equal(derivePersistedMarketCapUsd("unknown", "100"), null);
  assert.equal(derivePersistedMarketCapUsd(true, "100"), null);
});

test("legacy activity controls recency without fabricating an activity badge", () => {
  const rows: TickerTransactionRow[] = [
    {
      token_address: ADDRESS_A,
      timestamp: "2026-08-13T09:00:00.000Z",
      type: "buy",
      verified_at: null,
      token_details: coin(ADDRESS_A),
    },
  ];

  const [token] = buildTickerTokens(rows, [], 12);
  assert.equal(token.address, ADDRESS_A);
  assert.equal(token.lastActivity, null);
  assert.equal(token.marketCapUsd, 2500);
  assert.equal(token.holders, 3);
  assert.equal(token.metricsUpdatedAt, "2026-08-13T08:00:00.000Z");
});

test("verified activity is exposed and catalog fallback is deterministic", () => {
  const rows: TickerTransactionRow[] = [
    {
      token_address: ADDRESS_A,
      timestamp: "2026-08-13T09:00:00.000Z",
      type: "sell",
      verified_at: "2026-08-13T09:01:00.000Z",
      token_details: coin(ADDRESS_A),
    },
  ];

  const tokens = buildTickerTokens(rows, [coin(ADDRESS_A), coin(ADDRESS_B)], 2);
  assert.deepEqual(
    tokens.map((token) => token.address),
    [ADDRESS_A, ADDRESS_B]
  );
  assert.deepEqual(tokens[0].lastActivity, {
    type: "sell",
    timestamp: "2026-08-13T09:00:00.000Z",
  });
  assert.equal(tokens[1].lastActivity, null);
});

test("incomplete identities and creation-time metric placeholders are omitted", () => {
  const tokens = buildTickerTokens(
    [],
    [
      coin(ADDRESS_A, { symbol: "", current_price: "1" }),
      coin(ADDRESS_B, { current_price: "0", total_supply: "0", holders: 0 }),
    ],
    12
  );

  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].address, ADDRESS_B);
  assert.equal(tokens[0].marketCapUsd, null);
  assert.equal(tokens[0].holders, 0);
});
