import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeSourceTimestamp,
  parsePositiveUsdPrice,
} from "../src/lib/server/cryptoPrice.ts";

test("parsePositiveUsdPrice accepts finite positive numeric values", () => {
  assert.equal(parsePositiveUsdPrice("1862.42"), 1862.42);
  assert.equal(parsePositiveUsdPrice(0.5), 0.5);
});

test("parsePositiveUsdPrice rejects fabricated or malformed values", () => {
  for (const value of [
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    "",
    "nope",
    true,
    {},
  ]) {
    assert.throws(() => parsePositiveUsdPrice(value));
  }
});

test("normalizeSourceTimestamp only exposes plausibly fresh source times", () => {
  const observedAt = Date.parse("2026-08-11T12:00:00.000Z");

  assert.equal(
    normalizeSourceTimestamp(observedAt - 30_000, observedAt),
    "2026-08-11T11:59:30.000Z"
  );
  assert.equal(
    normalizeSourceTimestamp((observedAt - 30_000) / 1_000, observedAt),
    "2026-08-11T11:59:30.000Z"
  );
  assert.equal(
    normalizeSourceTimestamp(observedAt - 11 * 60_000, observedAt),
    undefined
  );
  assert.equal(
    normalizeSourceTimestamp(observedAt + 2 * 60_000, observedAt),
    undefined
  );
});
