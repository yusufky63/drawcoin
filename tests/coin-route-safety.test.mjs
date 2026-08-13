import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeSource = await readFile(
  new URL("../src/app/coin/[address]/page.tsx", import.meta.url),
  "utf8",
);

test("coin route validates the address before requesting token data", () => {
  const validationIndex = routeSource.indexOf(
    "!contractAddress || !isAddress(contractAddress)",
  );
  const requestIndex = routeSource.indexOf("getCoinDetails(contractAddress)");

  assert.ok(validationIndex >= 0, "address validation is missing");
  assert.ok(requestIndex > validationIndex, "validation must precede the request");
});

test("coin route fails closed instead of constructing a tradeable error token", () => {
  assert.doesNotMatch(routeSource, /Error Loading Token|symbol:\s*["']ERROR/);
  assert.match(routeSource, /setToken\(null\)/);

  const errorGateIndex = routeSource.indexOf("if (loadError || !token)");
  const tradeUiIndex = routeSource.indexOf("<CoinDetailPage token={token}");
  assert.ok(errorGateIndex >= 0, "error gate is missing");
  assert.ok(tradeUiIndex > errorGateIndex, "trade UI must be behind the error gate");
});

test("coin route exposes retry and back actions after timeout or fetch failure", () => {
  assert.match(routeSource, /TOKEN_REQUEST_TIMEOUT_MS/);
  assert.match(routeSource, /clearTimeout\(timeoutId\)/);
  assert.match(routeSource, /setRetryKey\(\(current\) => current \+ 1\)/);
  assert.match(routeSource, />\s*Try Again\s*</);
  assert.match(routeSource, />\s*Go Back\s*</);
});
