import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeSource = await readFile(
  new URL("../src/app/api/transactions/record/route.ts", import.meta.url),
  "utf8",
);

test("legacy transactions are upgraded only while they remain unverified", () => {
  assert.match(
    routeSource,
    /\.update\(verifiedTransactionFields\)[\s\S]*?\.eq\("id", existingTransaction\.id\)[\s\S]*?\.is\("verified_at", null\)[\s\S]*?\.select\("id"\)[\s\S]*?\.maybeSingle\(\)/,
  );
  assert.match(routeSource, /tx_hash:\s*normalizedHash/);
  assert.match(routeSource, /user_address:\s*normalizedUser/);
  assert.match(routeSource, /token_address:\s*tokenAddress/);
  assert.match(routeSource, /verified_at:\s*verifiedAt/);
});

test("verified replays compare wallet, token, and trade type without rewriting", () => {
  const identityGuard = routeSource.match(
    /function isSameVerifiedTransaction\([\s\S]*?\n}/,
  )?.[0];

  assert.ok(identityGuard, "verified transaction identity guard is missing");
  assert.match(identityGuard, /stored\.user_address/);
  assert.match(identityGuard, /stored\.token_address/);
  assert.match(identityGuard, /stored\.type === verified\.type/);
  assert.equal(
    identityGuard.match(/isAddressEqual\(/g)?.length,
    2,
    "wallet and token addresses must both be compared canonically",
  );

  assert.match(routeSource, /isVerifiedReplay = true/);
  assert.match(
    routeSource,
    /if \(!isVerifiedReplay\) \{[\s\S]*?if \(existingTransaction\)/,
  );
});

test("verified conflicts return 409 and are never resolved with an overwrite upsert", () => {
  assert.match(
    routeSource,
    /already registered to a different verified trade\."\s*,\s*409/,
  );
  assert.doesNotMatch(
    routeSource,
    /\.from\("transactions"\)[\s\S]{0,120}\.upsert\(/,
  );

  const receiptVerificationIndex = routeSource.indexOf(
    "const receipt = await basePublicClient.getTransactionReceipt",
  );
  const storedTransactionIndex = routeSource.indexOf(
    "const existingTransaction = await findStoredTransaction",
  );
  const userMutationIndex = routeSource.indexOf(
    'supabaseAdmin.from("users").upsert',
  );
  const verifiedConflictIndex = routeSource.indexOf(
    "if (!isSameVerifiedTransaction(existingTransaction, verifiedIdentity))",
  );

  assert.ok(receiptVerificationIndex >= 0);
  assert.ok(storedTransactionIndex > receiptVerificationIndex);
  assert.ok(verifiedConflictIndex > storedTransactionIndex);
  assert.ok(
    userMutationIndex > verifiedConflictIndex,
    "a conflicting verified replay must be rejected before any database write",
  );
});

test("transaction hashes are matched case-insensitively and insert races are rechecked", () => {
  assert.match(routeSource, /\.ilike\("tx_hash", txHash\)/);
  assert.match(routeSource, /insertError\.code !== "23505"/);
  assert.match(
    routeSource,
    /const concurrentTransaction\s*=\s*await findStoredTransaction\(normalizedHash\)/,
  );
});
