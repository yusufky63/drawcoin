import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeAdditionalOwners } from "../src/lib/create/additionalOwners.js";
import { assertIpfsMetadataURI } from "../src/lib/create/metadataUri.js";

const creator = "0x1111111111111111111111111111111111111111";
const owner = "0x52908400098527886E0F7030069857D2E4169EE7";

test("additional owners are checksummed and deduplicated case-insensitively", () => {
  assert.deepEqual(
    normalizeAdditionalOwners([owner, owner.toLowerCase()], creator),
    [owner]
  );
});

test("additional owners reject invalid addresses and the implicit creator owner", () => {
  assert.throws(
    () => normalizeAdditionalOwners(["0x1234"], creator),
    /additional owner address is invalid/i
  );
  assert.throws(
    () => normalizeAdditionalOwners([creator.toUpperCase().replace("0X", "0x")], creator),
    /creator is already an owner/i
  );
  assert.throws(
    () => normalizeAdditionalOwners("not-an-array", creator),
    /must be an array/i
  );
});

test("the skipped SDK metadata fetch remains restricted to immutable IPFS URIs", () => {
  const valid = "ipfs://bafybeigdyrzt5example/metadata.json";
  assert.equal(assertIpfsMetadataURI(valid), valid);

  for (const invalid of [
    "https://example.com/metadata.json",
    "data:application/json,{}",
    "ipfs://",
    " ipfs://bafybeigdyrzt5example",
    "ipfs://bafybeigdyrzt5example?gateway=1",
  ]) {
    assert.throws(() => assertIpfsMetadataURI(invalid), /valid ipfs:\/\/ URI/i);
  }
});

test("the supported Zora dependency tree is pinned and directly declared", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url)));
  const packageLock = JSON.parse(
    await readFile(new URL("../package-lock.json", import.meta.url))
  );

  assert.equal(packageJson.dependencies["@zoralabs/coins-sdk"], "0.4.1");
  assert.equal(
    packageJson.dependencies["@zoralabs/protocol-deployments"],
    "0.7.6"
  );
  assert.equal(
    packageLock.packages["node_modules/@zoralabs/coins-sdk"].version,
    "0.4.1"
  );
  assert.equal(
    packageLock.packages["node_modules/@zoralabs/protocol-deployments"].version,
    "0.7.6"
  );
});

test("unsupported creation controls and the unused gas multiplier stay removed", async () => {
  const sources = await Promise.all(
    [
      "../src/components/create/CreatePage.tsx",
      "../src/lib/functions/createToken.ts",
      "../src/services/sdk/getCreateCoin.js",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8"))
  );
  const creationSource = sources.join("\n");

  assert.doesNotMatch(creationSource, /startingMarketCap/);
  assert.doesNotMatch(creationSource, /smartWalletRouting/);
  assert.doesNotMatch(creationSource, /gasMultiplier/);
});

test("Base creation prepares one Zora call and lets the connected wallet estimate the final payload", async () => {
  const [sdkSource, createPageSource] = await Promise.all([
    readFile(
      new URL("../src/services/sdk/getCreateCoin.js", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../src/components/create/CreatePage.tsx", import.meta.url),
      "utf8"
    ),
  ]);

  assert.match(sdkSource, /createCoinCall/);
  assert.doesNotMatch(sdkSource, /\bcreateCoin\s*\(/);
  assert.match(sdkSource, /coinFactoryAddress\[targetChainId\]/);
  assert.match(sdkSource, /preparedCall\.value !== BigInt\(0\)/);
  assert.match(sdkSource, /receipt\.status !== "success"/);
  assert.doesNotMatch(sdkSource, /\bgasPrice\b|\bgas:\s*gas/);

  assert.match(createPageSource, /sendCallsAsync\(\{/);
  assert.match(createPageSource, /experimental_fallback: true/);
  assert.match(createPageSource, /waitForCallsStatus\(wagmiConfig/);
  assert.match(createPageSource, /throwOnFailure: true/);
});
