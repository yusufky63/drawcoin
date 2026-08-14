import assert from "node:assert/strict";
import test from "node:test";

import {
  BASE_CHAIN_ID,
  syncFreshCreation,
  syncCreatedToken,
  type CoinCreationRecordPayload,
} from "../src/lib/functions/coinCreationSync.ts";

const payload: CoinCreationRecordPayload = {
  name: "Recovery sketch",
  symbol: "RSC",
  description: "A recoverable canvas token",
  image_url: "ipfs://metadata",
  creator_address: "0x1111111111111111111111111111111111111111",
  tx_hash: `0x${"2".repeat(64)}`,
  chain_id: BASE_CHAIN_ID,
  currency: "ZORA",
  platform_referrer: "0x2222222222222222222222222222222222222222",
  contract_address: "0x3333333333333333333333333333333333333333",
};

test("syncCreatedToken performs one idempotent record request", async () => {
  let calls = 0;
  const result = await syncCreatedToken(payload, {
    fetcher: async (input, init) => {
      calls += 1;
      assert.equal(input, "/api/coins/create");
      assert.equal(init?.method, "POST");
      assert.equal(init?.credentials, "same-origin");
      assert.deepEqual(JSON.parse(String(init?.body)), payload);
      return Response.json({
        success: true,
        verified: true,
        data: { name: payload.name, contract_address: payload.contract_address },
      });
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.status, "recorded");
  assert.equal(result.error, undefined);
  assert.equal(result.coin?.contract_address, payload.contract_address);
});

test("syncCreatedToken returns a reusable payload and never retries a network failure", async () => {
  let calls = 0;
  const result = await syncCreatedToken(payload, {
    fetcher: async () => {
      calls += 1;
      throw new Error("private network details that must not be shown");
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.status, "sync_required");
  assert.equal(result.recoveryPayload, payload);
  assert.equal(result.error?.code, "NETWORK_ERROR");
  assert.equal(result.error?.retryable, true);
  assert.doesNotMatch(result.error?.message ?? "", /private network details/);
});

test("syncCreatedToken trusts only known safe server error codes", async () => {
  const result = await syncCreatedToken(payload, {
    fetcher: async () =>
      Response.json(
        {
          error: "database host and credentials must never reach the UI",
          code: "VERIFICATION_UNAVAILABLE",
        },
        { status: 503 }
      ),
  });

  assert.equal(result.status, "sync_required");
  assert.equal(result.error?.code, "VERIFICATION_UNAVAILABLE");
  assert.doesNotMatch(result.error?.message ?? "", /database host|credentials/);
});

test("unknown server errors fall back to status-based safe codes", async () => {
  const result = await syncCreatedToken(payload, {
    fetcher: async () =>
      Response.json(
        { error: "unsafe raw error", code: "INTERNAL_DB_DIAGNOSTIC" },
        { status: 409 }
      ),
  });

  assert.equal(result.error?.code, "RECORD_CONFLICT");
  assert.equal(result.error?.retryable, false);
  assert.doesNotMatch(result.error?.message ?? "", /unsafe raw error/);
});

test("a fresh creation retries only the idempotent record step while Base state propagates", async () => {
  let calls = 0;
  const delays: number[] = [];
  const result = await syncFreshCreation(payload, {
    fetcher: async () => {
      calls += 1;
      if (calls < 3) {
        return Response.json(
          { code: "BASE_STATE_PENDING", error: "provider lag" },
          { status: 503 }
        );
      }
      return Response.json({
        success: true,
        data: { contract_address: payload.contract_address },
      });
    },
    sleep: async (milliseconds) => {
      delays.push(milliseconds);
    },
  });

  assert.equal(calls, 3);
  assert.deepEqual(delays, [700, 1_400]);
  assert.equal(result.status, "recorded");
});

test("a deterministic creation mismatch is never retried", async () => {
  let calls = 0;
  const result = await syncFreshCreation(payload, {
    fetcher: async () => {
      calls += 1;
      return Response.json(
        { code: "ONCHAIN_CREATION_MISMATCH", error: "mismatch" },
        { status: 422 }
      );
    },
    sleep: async () => {
      throw new Error("a permanent mismatch must not sleep or retry");
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.error?.code, "ONCHAIN_CREATION_MISMATCH");
});
