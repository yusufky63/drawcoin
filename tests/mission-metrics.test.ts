import assert from "node:assert/strict";
import test from "node:test";

import { calculateMissionMetricValues } from "../src/lib/missions/metrics.ts";

test("mission metrics count verified actions and roles without trusting legacy rows", () => {
  const metrics = calculateMissionMetricValues({
    verifiedCreationDates: [
      "2026-08-10T01:00:00.000Z",
      "2026-08-10T20:00:00.000Z",
      "2026-08-11T12:00:00.000Z",
    ],
    verifiedTransactions: [
      { type: "buy", timestamp: "2026-08-11T17:00:00.000Z" },
      { type: "sell", timestamp: "2026-08-12T08:00:00.000Z" },
    ],
    verifiedWatchlistCount: 5,
  });

  assert.deepEqual(metrics, {
    verified_creation: 3,
    verified_buy: 1,
    watchlist_token: 5,
    ecosystem_role: 2,
    verified_activity_day: 3,
  });
});

test("ecosystem builder progress counts categories instead of repeated actions", () => {
  const metrics = calculateMissionMetricValues({
    verifiedCreationDates: ["2026-08-10T01:00:00.000Z"],
    verifiedTransactions: [
      { type: "sell", timestamp: "2026-08-11T17:00:00.000Z" },
      { type: "sell", timestamp: "2026-08-12T17:00:00.000Z" },
    ],
    verifiedWatchlistCount: -50,
  });

  assert.equal(metrics.ecosystem_role, 1);
  assert.equal(metrics.verified_buy, 0);
  assert.equal(metrics.watchlist_token, 0);
});

test("invalid timestamps never create synthetic activity days", () => {
  const metrics = calculateMissionMetricValues({
    verifiedCreationDates: [null, "not-a-date"],
    verifiedTransactions: [{ type: "buy", timestamp: null }],
    verifiedWatchlistCount: 0,
  });

  assert.equal(metrics.verified_creation, 2);
  assert.equal(metrics.verified_buy, 1);
  assert.equal(metrics.verified_activity_day, 0);
});
