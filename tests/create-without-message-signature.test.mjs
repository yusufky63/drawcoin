import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [pageSource, uploadRouteSource, createRouteSource] = await Promise.all([
  readFile(
    new URL("../src/components/create/CreatePage.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../src/app/api/ipfs/upload/route.ts", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../src/app/api/coins/create/route.ts", import.meta.url),
    "utf8",
  ),
]);

test("coin creation does not request a separate SIWE message", () => {
  assert.doesNotMatch(pageSource, /useWalletSession|signIn\(/);
  assert.doesNotMatch(uploadRouteSource, /requireWalletSession|SessionError/);
  assert.doesNotMatch(createRouteSource, /requireWalletSession|SessionError/);
});

test("message-free recording remains bound to the official onchain creator", () => {
  assert.match(createRouteSource, /coinFactoryAddress\[base\.id\]/);
  assert.match(
    createRouteSource,
    /const eventCaller = getAddress\(deployment\.caller\)/,
  );
  assert.match(
    createRouteSource,
    /const matchesCreator = isAddressEqual\(creatorAddress, eventCaller\)/,
  );
  assert.match(createRouteSource, /!matchesCreator/);
  assert.match(createRouteSource, /receipt\.status !== "success"/);
});
