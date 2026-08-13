import assert from "node:assert/strict";
import test from "node:test";

import { createDraftStorageInternals } from "../src/lib/create/draftStorage.ts";

const canvas = {
  version: 1 as const,
  canvas: { width: 1024, height: 1024, background: "#ffffff" },
  elements: [
    {
      type: "line",
      color: "#000000",
      lineWidth: 4,
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ],
    },
  ],
};

test("create draft parser accepts the versioned minimal payload", () => {
  const parsed = createDraftStorageInternals.parseCreateDraft({
    version: 1,
    updatedAt: Date.now(),
    currentStep: 2,
    canvas,
    details: { name: "Daily Lines", symbol: "LINE", description: "A study" },
    options: { startingMarketCap: 0, ownersAddresses: [] },
  });

  assert.equal(parsed?.currentStep, 2);
  assert.equal(parsed?.canvas?.canvas.width, 1024);
  assert.equal(parsed?.details.symbol, "LINE");
  assert.deepEqual(parsed?.options, { ownersAddresses: [] });
  assert.equal("startingMarketCap" in (parsed?.options ?? {}), false);
});

test("create draft parser rejects stale or differently sized scenes", () => {
  const baseDraft = {
    version: 1,
    updatedAt: Date.now(),
    currentStep: 1,
    canvas,
    details: { name: "", symbol: "", description: "" },
    options: { startingMarketCap: 0, ownersAddresses: [] },
  };

  assert.equal(
    createDraftStorageInternals.parseCreateDraft({
      ...baseDraft,
      canvas: {
        ...canvas,
        canvas: { ...canvas.canvas, width: 400, height: 400 },
      },
    }),
    null
  );
  assert.equal(
    createDraftStorageInternals.parseCreateDraft({
      ...baseDraft,
      updatedAt: Date.now() - 15 * 24 * 60 * 60 * 1_000,
    }),
    null
  );
});

test("pending creation parser accepts only Base transaction recovery data", () => {
  const pending = {
    version: 1,
    updatedAt: Date.now(),
    transactionHash: `0x${"a".repeat(64)}`,
    tokenAddress: `0x${"b".repeat(40)}`,
    payload: {
      name: "Daily Lines",
      symbol: "LINE",
      description: "A study",
      contract_address: `0x${"b".repeat(40)}`,
      image_url: "ipfs://example",
      creator_address: `0x${"c".repeat(40)}`,
      tx_hash: `0x${"a".repeat(64)}`,
      chain_id: 8453,
      currency: "ZORA",
      platform_referrer: `0x${"d".repeat(40)}`,
    },
  };

  assert.equal(
    createDraftStorageInternals.parsePendingCreation(pending)?.transactionHash,
    pending.transactionHash
  );
  assert.equal(
    createDraftStorageInternals.parsePendingCreation({
      ...pending,
      payload: { ...pending.payload, chain_id: 84532 },
    }),
    null
  );
});

test("pending creation parser requires one consistent transaction identity", () => {
  const pending = {
    version: 1,
    updatedAt: Date.now(),
    transactionHash: `0x${"a".repeat(64)}`,
    tokenAddress: `0x${"b".repeat(40)}`,
    payload: {
      name: "Daily Lines",
      symbol: "LINE",
      description: "A study",
      contract_address: `0x${"b".repeat(40)}`,
      image_url: "ipfs://example",
      creator_address: `0x${"c".repeat(40)}`,
      tx_hash: `0x${"a".repeat(64)}`,
      chain_id: 8453,
      currency: "ZORA",
      platform_referrer: `0x${"d".repeat(40)}`,
    },
  };

  assert.ok(createDraftStorageInternals.parsePendingCreation(pending));
  assert.equal(
    createDraftStorageInternals.parsePendingCreation({
      ...pending,
      transactionHash: `0x${"e".repeat(64)}`,
    }),
    null
  );
  assert.equal(
    createDraftStorageInternals.parsePendingCreation({
      ...pending,
      tokenAddress: "not-an-address",
    }),
    null
  );
  assert.equal(
    createDraftStorageInternals.parsePendingCreation({
      ...pending,
      tokenAddress: `0x${"e".repeat(40)}`,
    }),
    null
  );
  assert.equal(
    createDraftStorageInternals.parsePendingCreation({
      ...pending,
      payload: { ...pending.payload, contract_address: "0x1234" },
    }),
    null
  );
});

test("pending creation parser permits a receipt-derived address to be pending", () => {
  const transactionHash = `0x${"a".repeat(64)}`;
  const parsed = createDraftStorageInternals.parsePendingCreation({
    version: 1,
    updatedAt: Date.now(),
    transactionHash,
    tokenAddress: null,
    payload: {
      name: "Daily Lines",
      symbol: "LINE",
      description: "A study",
      image_url: "ipfs://example",
      creator_address: `0x${"c".repeat(40)}`,
      tx_hash: transactionHash.toUpperCase().replace("0X", "0x"),
      chain_id: 8453,
      currency: "ETH",
      platform_referrer: `0x${"d".repeat(40)}`,
    },
  });

  assert.equal(parsed?.tokenAddress, null);
  assert.equal(parsed?.transactionHash, transactionHash);
});
