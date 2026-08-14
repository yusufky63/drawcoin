import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [globalStyles, cardSource] = await Promise.all([
  readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../src/components/market/TokenCard.tsx", import.meta.url), "utf8"),
]);

test("mobile market cards do not reserve space for the retired trade overlay", () => {
  assert.doesNotMatch(globalStyles, /\.token-card-shell\s*\{[^}]*padding-bottom:\s*5\.5rem/s);
  assert.doesNotMatch(globalStyles, /\.token-card-actions/);
  assert.doesNotMatch(cardSource, /token-card-actions/);
});
