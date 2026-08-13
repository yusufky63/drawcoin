import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/hooks/useWatchlist.ts", import.meta.url),
  "utf8",
);

test("watchlist additions use a device save without forcing wallet sign-in", () => {
  const addBlock = source.slice(
    source.indexOf("const addToWatchlist"),
    source.indexOf("const removeFromWatchlist"),
  );

  assert.match(addBlock, /sessionStatus !== "authenticated"/);
  assert.match(addBlock, /updateDeviceWatchlist/);
  assert.match(addBlock, /Saved on this device/);
  assert.doesNotMatch(addBlock, /await signIn\(/);
});

test("device watchlist storage accepts only EVM token addresses", () => {
  assert.match(source, /drawcoin:device-watchlist:v1/);
  assert.match(source, /\^0x\[0-9a-fA-F\]\{40\}\$/);
  assert.match(source, /writeDeviceWatchlist/);
});

test("authenticated server watchlists remain available for mission-backed saves", () => {
  assert.match(source, /setServerWatchlist\(items\.map/);
  assert.match(source, /method: "POST"/);
  assert.match(source, /method: "DELETE"/);
  assert.match(source, /requiresSignIn:/);
});
