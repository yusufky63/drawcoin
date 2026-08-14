import assert from "node:assert/strict";
import test from "node:test";
import { parseUnits } from "viem";

import {
  amountForPercentage,
  ETH_GAS_RESERVE_WEI,
  formatTradeBalance,
  parseTradeAmount,
  percentageForAmount,
} from "../src/lib/tradeAmount.ts";

test("100% token sell preserves the exact raw balance", () => {
  const balance = BigInt("140716531123456789012345678");
  const amount = amountForPercentage(balance, 18, 100);
  assert.equal(parseUnits(amount, 18), balance);
  assert.equal(percentageForAmount(amount, 18, balance), 100);
});

test("small balances and six-decimal USDC never round through Number", () => {
  assert.equal(amountForPercentage(BigInt(7), 18, 100), "0.000000000000000007");
  assert.equal(amountForPercentage(BigInt(1_234_567), 6, 50), "0.617283");
  assert.equal(parseTradeAmount("0.0000001", 6), null);
});

test("ETH maximum keeps a deterministic gas reserve", () => {
  const balance = parseUnits("0.01", 18);
  const amount = amountForPercentage(balance, 18, 100, ETH_GAS_RESERVE_WEI);
  assert.equal(parseUnits(amount, 18), balance - ETH_GAS_RESERVE_WEI);
});

test("display formatting cannot change the raw transaction amount", () => {
  assert.equal(formatTradeBalance(parseUnits("12.345678901", 18), 18, 6), "12.345678");
  assert.equal(parseTradeAmount("12.345678901", 18), parseUnits("12.345678901", 18));
});
