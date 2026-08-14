import assert from "node:assert/strict";
import test from "node:test";

import { calculateMissionMetricValues } from "../src/lib/missions/metrics.ts";

test("mission metrics count verified actions and roles without trusting legacy rows", () => {
  const metrics = calculateMissionMetricValues({
    walletAddress: "0x1111111111111111111111111111111111111111",
    verifiedCreationDates: [
      "2026-08-10T01:00:00.000Z",
      "2026-08-10T20:00:00.000Z",
      "2026-08-11T12:00:00.000Z",
    ],
    verifiedTransactions: [
      {
        type: "buy",
        timestamp: "2026-08-11T17:00:00.000Z",
        tokenAddress: "0x2222222222222222222222222222222222222222",
        creatorAddress: "0x3333333333333333333333333333333333333333",
      },
      {
        type: "sell",
        timestamp: "2026-08-12T08:00:00.000Z",
        tokenAddress: "0x2222222222222222222222222222222222222222",
      },
    ],
  });

  assert.deepEqual(metrics, {
    verified_creation: 3,
    verified_buy: 1,
    watchlist_token: 0,
    ecosystem_role: 2,
    verified_activity_day: 3,
    verified_trade: 2,
    distinct_collected_coin: 1,
    round_trip_token: 1,
    verified_trade_day: 2,
    completed_standard_mission: 0,
  });
});

test("ecosystem builder progress counts categories instead of repeated actions", () => {
  const metrics = calculateMissionMetricValues({
    walletAddress: "0x1111111111111111111111111111111111111111",
    verifiedCreationDates: ["2026-08-10T01:00:00.000Z"],
    verifiedTransactions: [
      { type: "sell", timestamp: "2026-08-11T17:00:00.000Z" },
      { type: "sell", timestamp: "2026-08-12T17:00:00.000Z" },
    ],
  });

  assert.equal(metrics.ecosystem_role, 1);
  assert.equal(metrics.verified_buy, 0);
  assert.equal(metrics.watchlist_token, 0);
});

test("invalid timestamps never create synthetic activity days", () => {
  const metrics = calculateMissionMetricValues({
    walletAddress: "0x1111111111111111111111111111111111111111",
    verifiedCreationDates: [null, "not-a-date"],
    verifiedTransactions: [{ type: "buy", timestamp: null }],
  });

  assert.equal(metrics.verified_creation, 2);
  assert.equal(metrics.verified_buy, 1);
  assert.equal(metrics.verified_activity_day, 0);
});

test("collection diversity excludes self-created coins and deduplicates tokens", () => {
  const walletAddress = "0x1111111111111111111111111111111111111111";
  const metrics = calculateMissionMetricValues({
    walletAddress,
    verifiedCreationDates: [],
    verifiedTransactions: [
      {
        type: "buy",
        timestamp: "2026-08-10T12:00:00.000Z",
        tokenAddress: "0x2222222222222222222222222222222222222222",
        creatorAddress: "0x3333333333333333333333333333333333333333",
      },
      {
        type: "buy",
        timestamp: "2026-08-11T12:00:00.000Z",
        tokenAddress: "0x2222222222222222222222222222222222222222",
        creatorAddress: "0x3333333333333333333333333333333333333333",
      },
      {
        type: "buy",
        timestamp: "2026-08-12T12:00:00.000Z",
        tokenAddress: "0x4444444444444444444444444444444444444444",
        creatorAddress: walletAddress,
      },
    ],
  });

  assert.equal(metrics.distinct_collected_coin, 1);
  assert.equal(metrics.verified_trade, 3);
  assert.equal(metrics.verified_trade_day, 3);
});
