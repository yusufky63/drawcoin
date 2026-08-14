import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const analyticsSource = await readFile(
  new URL("../src/services/analyticsService.ts", import.meta.url),
  "utf8",
);
const pageSource = await readFile(
  new URL("../src/components/portfolio/PortfolioPage.tsx", import.meta.url),
  "utf8",
);

test("portfolio catalog lookup is bounded to wallet-owned token addresses", () => {
  assert.match(analyticsSource, /addressBatches/);
  assert.match(analyticsSource, /mapWithConcurrency\(\s*addressBatches,\s*4,/);
  assert.match(analyticsSource, /\.in\("contract_address", addressBatch\)/);
  assert.doesNotMatch(
    analyticsSource,
    /\.select\("contract_address, name, symbol, image_url, creator_address"\)\s*;/,
  );
});

test("portfolio optional data does not block or overwrite the active wallet", () => {
  assert.match(pageSource, /requestSequenceRef/);
  assert.match(pageSource, /Promise\.all\(\[/);
  assert.match(pageSource, /COIN_SNAPSHOT_COLUMNS/);
  assert.match(pageSource, /resolveCreatorBasenames\(\[address\]\)/);
  assert.doesNotMatch(pageSource, /getUserProfile|getUserCreatedCoins|zoraProfile/);
});

test("portfolio sorting is memoized", () => {
  assert.match(pageSource, /const sortedPortfolio = useMemo/);
  assert.match(pageSource, /const sortedCreatedTokens = useMemo/);
  assert.doesNotMatch(pageSource, /getSortedPortfolio|getSortedCreatedTokens/);
});
