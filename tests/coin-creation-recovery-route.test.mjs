import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeSource = await readFile(
  new URL("../src/app/api/coins/create/route.ts", import.meta.url),
  "utf8"
);
const createTokenSource = await readFile(
  new URL("../src/lib/functions/createToken.ts", import.meta.url),
  "utf8"
);

test("recovery needs no message signature and re-verifies the official Base receipt", () => {
  const receiptIndex = routeSource.indexOf(
    "basePublicClient.getTransactionReceipt"
  );
  const databaseWriteIndex = routeSource.indexOf(
    'supabaseAdmin.from("users").upsert'
  );

  assert.ok(receiptIndex >= 0);
  assert.ok(databaseWriteIndex > receiptIndex);
  assert.match(routeSource, /coinFactoryAddress\[base\.id\]/);
  assert.match(routeSource, /deployment\.caller/);
  assert.match(routeSource, /deployment\.platformReferrer/);
  assert.match(routeSource, /deployment\.name !== input\.name/);
  assert.match(routeSource, /deployment\.symbol !== input\.symbol/);
  assert.match(routeSource, /deployment\.uri !== input\.image_url/);
  assert.doesNotMatch(routeSource, /requireWalletSession|SessionError/);
  assert.match(routeSource, /const matchesCreator = isAddressEqual\(creatorAddress, eventCaller\)/);
});

test("the stored currency label is derived from and matched to the onchain event", () => {
  const verifiedFieldsStart = routeSource.indexOf(
    "const verifiedCoinFields = {"
  );
  const verifiedFieldsEnd = routeSource.indexOf(
    "} as const;",
    verifiedFieldsStart
  );
  const verifiedFields = routeSource.slice(
    verifiedFieldsStart,
    verifiedFieldsEnd
  );

  assert.match(routeSource, /const eventCurrency = getAddress\(deployment\.currency\)/);
  assert.match(routeSource, /verifyCreationCurrency\(\s*input\.currency,\s*eventCurrency/);
  assert.match(routeSource, /isAddressEqual\(eventCurrency, ZORA_BASE_CURRENCY_ADDRESS\)/);
  assert.match(routeSource, /isAddressEqual\(eventCurrency, zeroAddress\)/);
  assert.match(verifiedFields, /currency:\s*verifiedCurrency/);
  assert.doesNotMatch(verifiedFields, /currency:\s*input\.currency/);
  assert.match(routeSource, /!verifiedCurrency/);
});

test("same-transaction recovery is idempotent and resolves insert races safely", () => {
  assert.match(routeSource, /isSameVerifiedCreation\(/);
  assert.match(routeSource, /error\.code !== "23505"/);
  assert.match(routeSource, /const concurrentCoin = await findStoredCoin/);
  assert.match(routeSource, /\.is\("verified_at", null\)/);
  assert.match(routeSource, /"RECORD_CONFLICT"/);
});

test("transaction hash conflicts are identity-checked and never ignored", () => {
  const transactionPreflightIndex = routeSource.indexOf(
    "findStoredCreateTransaction(normalizedHash)"
  );
  const firstDatabaseWriteIndex = routeSource.indexOf(
    'supabaseAdmin.from("users").upsert'
  );

  assert.ok(transactionPreflightIndex >= 0);
  assert.ok(firstDatabaseWriteIndex > transactionPreflightIndex);
  assert.match(routeSource, /isSameCanonicalCreateTransaction\(/);
  assert.match(routeSource, /stored\.type === "create"/);
  assert.match(routeSource, /stored\.user_address/);
  assert.match(routeSource, /stored\.token_address/);
  assert.match(routeSource, /\.update\(verifiedTransactionFields\)/);
  assert.match(routeSource, /insertError\.code !== "23505"/);
  assert.match(
    routeSource,
    /const concurrentTransaction\s*=\s*await findStoredCreateTransaction\(normalizedHash\)/
  );
  assert.doesNotMatch(
    routeSource,
    /\.from\("transactions"\)[\s\S]{0,180}\.upsert\(/
  );
  assert.doesNotMatch(routeSource, /ignoreDuplicates:\s*true/);
});

test("the recovery API returns stable public error codes without database details", () => {
  assert.match(routeSource, /\{ error, code \}/);
  assert.match(routeSource, /"VERIFICATION_UNAVAILABLE"/);
  assert.match(
    routeSource,
    /catch \(error\) \{[\s\S]*?console\.error\("Failed to verify and save Base coin creation", error\);[\s\S]*?"Coin verification is temporarily unavailable\."/
  );
});

test("temporary Base bytecode propagation is retryable instead of a false mismatch", () => {
  assert.match(routeSource, /blockNumber: receipt\.blockNumber/);
  assert.match(routeSource, /"BASE_STATE_PENDING"/);
  assert.match(
    routeSource,
    /!bytecode \|\| bytecode === "0x"[\s\S]*?503,[\s\S]*?"BASE_STATE_PENDING"/
  );
});

test("minting confirms Base after one async switch and never retries the transaction", () => {
  assert.match(
    createTokenSource,
    /await switchChainAsync\(\{ chainId: BASE_CHAIN_ID \}\)/
  );
  assert.match(
    createTokenSource,
    /const confirmedChainId = await walletClient\.getChainId\(\)/
  );
  assert.match(createTokenSource, /chainId: BASE_CHAIN_ID/);
  assert.match(createTokenSource, /selectBasePublicClient\(publicClient\)/);
  assert.equal(createTokenSource.match(/await createZoraCoin\(/g)?.length, 1);
  assert.doesNotMatch(createTokenSource, /setTimeout|checkAndSwitchNetwork/);
});
