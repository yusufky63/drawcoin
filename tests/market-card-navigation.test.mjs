import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [cardSource, gridSource, marketSource] = await Promise.all([
  readFile(new URL("../src/components/market/TokenCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/market/TokenGrid.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/market/MarketPage.tsx", import.meta.url), "utf8"),
]);

test("market cards navigate directly to coin details without hover trade actions", () => {
  assert.match(cardSource, /href=\{`\/coin\/\$\{token\.contract_address\}`\}/);
  assert.match(gridSource, /href=\{`\/coin\/\$\{token\.contract_address\}`\}/);
  assert.doesNotMatch(cardSource, /token-card-actions|handleTradeClick|>\s*Trade\s*</);
  assert.doesNotMatch(gridSource, /onTrade|>\s*Trade\s*</);
  assert.doesNotMatch(marketSource, /DetailsModal|tradeModalOpen|selectedToken|onTrade=/);
});
