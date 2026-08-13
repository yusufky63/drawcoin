import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("a signed-in owner can remove an unverified legacy watchlist row", async () => {
  const route = await readFile(
    new URL("../src/app/api/watchlist/route.ts", import.meta.url),
    "utf8"
  );
  const deleteHandler = route.slice(route.indexOf("export async function DELETE"));

  assert.match(deleteHandler, /requireWalletSession\(\)/);
  assert.match(deleteHandler, /\.eq\("user_address", session\.address\.toLowerCase\(\)\)/);
  assert.match(deleteHandler, /\.ilike\("token_address", getAddress\(input\.tokenAddress\)\)/);
  assert.doesNotMatch(deleteHandler, /findVerifiedCoin\(/);
});
