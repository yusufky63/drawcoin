import assert from "node:assert/strict";
import test from "node:test";

import { coinV4ABI } from "@zoralabs/protocol-deployments";
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import {
  entryPoint06Abi,
  entryPoint06Address,
} from "viem/account-abstraction";

import { findLegacyTradeProof } from "../src/lib/missions/legacyTradeProof.ts";

const user = "0x1111111111111111111111111111111111111111" as Address;
const token = "0x2222222222222222222222222222222222222222" as Address;
const pool = "0x3333333333333333333333333333333333333333" as Address;
const router = "0x6fF5693b99212Da76ad316178A184AB56D299b43" as Address;
const other = "0x4444444444444444444444444444444444444444" as Address;

function eventLog(address: Address, topics: unknown, data: Hex, logIndex: number) {
  return { address, topics, data, logIndex } as never;
}

function transferLog(from: Address, to: Address, value: bigint, logIndex = 4) {
  const topics = encodeEventTopics({
    abi: erc20Abi,
    eventName: "Transfer",
    args: { from, to },
  });
  return eventLog(
    token,
    topics,
    encodeAbiParameters([{ type: "uint256" }], [value]),
    logIndex
  );
}

function receipt(logs: unknown[]) {
  return { logs } as never;
}

test("accepts a positive token transfer through Zora's Base Universal Router", () => {
  const proof = findLegacyTradeProof({
    receipt: receipt([transferLog(pool, user, BigInt(25))]),
    transaction: { from: user, to: router },
    token,
    user,
    type: "buy",
  });

  assert.deepEqual(proof, {
    eventName: "CoinBuy",
    logIndex: 4,
    proofKind: "universal_router_transfer",
    verifierVersion: 2,
  });
});

test("rejects transfers through an unapproved target or with the wrong signer", () => {
  const logs = [transferLog(pool, user, BigInt(25))];
  assert.equal(
    findLegacyTradeProof({
      receipt: receipt(logs),
      transaction: { from: user, to: other },
      token,
      user,
      type: "buy",
    }),
    null
  );
  assert.equal(
    findLegacyTradeProof({
      receipt: receipt(logs),
      transaction: { from: other, to: router },
      token,
      user,
      type: "buy",
    }),
    null
  );
});

test("accepts EntryPoint execution only for the matching successful smart account", () => {
  const topics = encodeEventTopics({
    abi: entryPoint06Abi,
    eventName: "UserOperationEvent",
    args: {
      userOpHash: `0x${"ab".repeat(32)}`,
      sender: user,
      paymaster: zeroAddress,
    },
  });
  const userOperation = eventLog(
    entryPoint06Address,
    topics,
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "bool" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      [BigInt(1), true, BigInt(10), BigInt(20)]
    ),
    2
  );

  const proof = findLegacyTradeProof({
    receipt: receipt([userOperation, transferLog(pool, user, BigInt(25))]),
    transaction: { from: other, to: entryPoint06Address },
    token,
    user,
    type: "buy",
  });
  assert.equal(proof?.proofKind, "entrypoint_transfer");
  assert.equal(proof?.verifierVersion, 2);
});

test("prefers a direct CoinBuy event and rejects zero-value transfers", () => {
  const topics = encodeEventTopics({
    abi: coinV4ABI,
    eventName: "CoinBuy",
    args: { buyer: user, recipient: user, tradeReferrer: zeroAddress },
  });
  const directEvent = eventLog(
    token,
    topics,
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      [BigInt(25), zeroAddress, BigInt(1), BigInt(2)]
    ),
    8
  );
  const direct = findLegacyTradeProof({
    receipt: receipt([directEvent]),
    transaction: null,
    token,
    user,
    type: "buy",
  });
  assert.deepEqual(direct, {
    eventName: "CoinBuy",
    logIndex: 8,
    proofKind: "direct_coin_event",
    verifierVersion: 1,
  });

  assert.equal(
    findLegacyTradeProof({
      receipt: receipt([transferLog(pool, user, BigInt(0))]),
      transaction: { from: user, to: router },
      token,
      user,
      type: "buy",
    }),
    null
  );
});
