import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const portfolioSource = await readFile(
  new URL("../src/services/portfolioService.js", import.meta.url),
  "utf8"
);
const profileSource = await readFile(
  new URL("../src/services/sdk/getProfiles.js", import.meta.url),
  "utf8"
);
const tradesSource = await readFile(
  new URL("../src/components/trades/RecentTrades.tsx", import.meta.url),
  "utf8"
);

test("profile queries use the published 0.4.1 parameter contract", () => {
  assert.doesNotMatch(portfolioSource, /chainId:\s*8453/);
  assert.match(portfolioSource, /chainIds:\s*\[8453\]/);
  assert.match(portfolioSource, /throwOnError:\s*true/);

  assert.doesNotMatch(profileSource, /chainId:\s*8453/);
  assert.match(profileSource, /chainIds:\s*\[8453\]/);
  assert.match(profileSource, /throwOnError:\s*true/);
});

test("the private Zora key is gated from the browser bundle", () => {
  for (const source of [portfolioSource, profileSource]) {
    assert.match(source, /typeof window === ["']undefined["']/);
    assert.doesNotMatch(source, /NEXT_PUBLIC_ZORA_API_KEY/);
  }
});

test("recent swaps fail loudly without overlapping hidden-tab polling", () => {
  assert.match(tradesSource, /throwOnError:\s*true/);
  assert.match(tradesSource, /new AbortController\(\)/);
  assert.match(tradesSource, /requestInFlight/);
  assert.match(tradesSource, /document\.visibilityState === ["']hidden["']/);
  assert.match(tradesSource, /setInterval\(fetchTrades, 30_000\)/);
});
