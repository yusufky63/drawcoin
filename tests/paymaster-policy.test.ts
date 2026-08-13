import assert from "node:assert/strict";
import test from "node:test";
import {
  concatHex,
  encodeFunctionData,
  getAddress,
  isAddressEqual,
  keccak256,
  pad,
  type Address,
  type Hex,
} from "viem";
import {
  BASE_ACCOUNT_FACTORY_ADDRESS,
  BASE_ACCOUNT_V1_IMPLEMENTATION_ADDRESS,
  ENTRY_POINT_V06_ADDRESS,
  attestBaseAccountSender,
  baseAccountFactoryAbi,
  parseBaseAccountDeployment,
  validatePaymasterRequestShape,
  type BaseAccountReader,
  type PaymasterGrantShape,
} from "../src/lib/badges/paymasterPolicyCore.ts";

const sender = getAddress("0x1111111111111111111111111111111111111111");
const badge = getAddress("0x2222222222222222222222222222222222222222");
const otherAddress = getAddress("0x3333333333333333333333333333333333333333");
const deadline = 2_000_000_000;

const claimAbi = [
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const executeAbi = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "target", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const erc7579ExecuteAbi = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "mode", type: "bytes32" },
      { name: "executionCalldata", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const claimCallData = encodeFunctionData({
  abi: claimAbi,
  functionName: "claim",
  args: [BigInt(1), BigInt(7), BigInt(deadline), "0x1234"],
});

const grant: PaymasterGrantShape = {
  account: sender,
  contractAddress: badge,
  chainId: 84_532,
  tokenId: "1",
  nonce: "7",
  expiresAt: deadline,
  claimCallDataHash: keccak256(claimCallData),
};

function makeRequest(callData: Hex, initCode: Hex = "0x") {
  const params: unknown[] = [
    { sender, callData, initCode },
    ENTRY_POINT_V06_ADDRESS,
    "0x14a34",
  ];

  return {
    jsonrpc: "2.0",
    id: 1,
    method: "pm_getPaymasterData",
    params,
  };
}

function badgeExecute(target: Address = badge, value = BigInt(0)) {
  return encodeFunctionData({
    abi: executeAbi,
    functionName: "execute",
    args: [target, value, claimCallData],
  });
}

test("accepts one exact badge claim through Coinbase execute", () => {
  const input = {
    ...makeRequest(badgeExecute()),
    untrustedExtension: { arbitrary: "payload" },
  };
  const result = validatePaymasterRequestShape(input, grant);
  assert.equal(result.allowed, true);
  if (result.allowed) {
    assert.equal(result.deployment.kind, "deployed");
    assert.deepEqual(result.request, makeRequest(badgeExecute()));
    assert.equal("untrustedExtension" in result.request, false);
  }

  // viem serializes an omitted ERC-7677 context as a fourth JSON null.
  const viemRequest = makeRequest(badgeExecute());
  viemRequest.params.push(null);
  assert.equal(validatePaymasterRequestShape(viemRequest, grant).allowed, true);

  viemRequest.params[3] = { sponsorshipPolicyId: "untrusted-override" };
  assert.equal(validatePaymasterRequestShape(viemRequest, grant).allowed, false);
});

test("rejects a different target, ETH value, or EntryPoint", () => {
  assert.equal(
    validatePaymasterRequestShape(makeRequest(badgeExecute(otherAddress)), grant)
      .allowed,
    false
  );
  assert.equal(
    validatePaymasterRequestShape(
      makeRequest(badgeExecute(badge, BigInt(1))),
      grant
    ).allowed,
    false
  );

  const wrongEntryPoint = makeRequest(badgeExecute());
  wrongEntryPoint.params[1] = otherAddress;
  assert.equal(validatePaymasterRequestShape(wrongEntryPoint, grant).allowed, false);
});

test("rejects generic ERC-7579 and EIP-7702 user operations", () => {
  const genericExecute = encodeFunctionData({
    abi: erc7579ExecuteAbi,
    functionName: "execute",
    args: [`0x${"00".repeat(32)}`, claimCallData],
  });
  assert.equal(
    validatePaymasterRequestShape(makeRequest(genericExecute), grant).allowed,
    false
  );

  const eip7702 = makeRequest(badgeExecute());
  (eip7702.params[0] as Record<string, unknown>).eip7702Auth = {
    address: otherAddress,
  };
  assert.equal(validatePaymasterRequestShape(eip7702, grant).allowed, false);
});

test("accepts only canonical counterfactual factory initCode", () => {
  const factoryData = encodeFunctionData({
    abi: baseAccountFactoryAbi,
    functionName: "createAccount",
    args: [[pad(sender)], BigInt(9)],
  });
  const canonicalInitCode = concatHex([
    BASE_ACCOUNT_FACTORY_ADDRESS,
    factoryData,
  ]);

  const result = validatePaymasterRequestShape(
    makeRequest(badgeExecute(), canonicalInitCode),
    grant
  );
  assert.equal(result.allowed, true);
  if (result.allowed) {
    assert.deepEqual(result.deployment, {
      kind: "counterfactual",
      owners: [pad(sender)],
      nonce: BigInt(9),
    });
  }

  const maliciousInitCode = concatHex([otherAddress, factoryData]);
  assert.equal(parseBaseAccountDeployment(maliciousInitCode), null);
});

// Runtime returned by a CoinbaseSmartWalletFactory v1.1 deployment. Its hash is
// pinned in the production policy, so an ABI-compatible attacker contract fails.
const canonicalProxyRuntime =
  "0x363d3d373d3d363d7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc545af43d6000803e6038573d6000fd5b3d6000f3" as Hex;

function createReader(options?: {
  senderCode?: Hex;
  factoryImplementation?: Address;
  accountImplementation?: Address;
  accountEntryPoint?: Address;
  counterfactualAddress?: Address;
}): BaseAccountReader {
  return {
    getBytecode: async (address) => {
      if (isAddressEqual(address, BASE_ACCOUNT_FACTORY_ADDRESS)) return "0x6000";
      if (isAddressEqual(address, BASE_ACCOUNT_V1_IMPLEMENTATION_ADDRESS)) {
        return "0x6001";
      }
      if (isAddressEqual(address, sender)) return options?.senderCode;
      return undefined;
    },
    getFactoryImplementation: async () =>
      options?.factoryImplementation ?? BASE_ACCOUNT_V1_IMPLEMENTATION_ADDRESS,
    getAccountImplementation: async () =>
      options?.accountImplementation ?? BASE_ACCOUNT_V1_IMPLEMENTATION_ADDRESS,
    getAccountEntryPoint: async () =>
      options?.accountEntryPoint ?? ENTRY_POINT_V06_ADDRESS,
    getCounterfactualAddress: async () =>
      options?.counterfactualAddress ?? sender,
  };
}

test("attests a deployed canonical Base Account", async () => {
  assert.equal(
    await attestBaseAccountSender(
      sender,
      { kind: "deployed" },
      createReader({ senderCode: canonicalProxyRuntime })
    ),
    true
  );
});

test("rejects a deployed account with a noncanonical runtime or implementation", async () => {
  assert.equal(
    await attestBaseAccountSender(
      sender,
      { kind: "deployed" },
      createReader({ senderCode: "0x6000" })
    ),
    false
  );
  assert.equal(
    await attestBaseAccountSender(
      sender,
      { kind: "deployed" },
      createReader({
        senderCode: canonicalProxyRuntime,
        accountImplementation: otherAddress,
      })
    ),
    false
  );
});

test("attests a canonical undeployed Base Account factory derivation", async () => {
  assert.equal(
    await attestBaseAccountSender(
      sender,
      { kind: "counterfactual", owners: [pad(sender)], nonce: BigInt(9) },
      createReader()
    ),
    true
  );
});

test("rejects a counterfactual sender that the factory does not derive", async () => {
  assert.equal(
    await attestBaseAccountSender(
      sender,
      { kind: "counterfactual", owners: [pad(sender)], nonce: BigInt(9) },
      createReader({ counterfactualAddress: otherAddress })
    ),
    false
  );
});
