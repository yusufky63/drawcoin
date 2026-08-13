import {
  decodeFunctionData,
  getAddress,
  isAddress,
  isAddressEqual,
  isHex,
  keccak256,
  size,
  sliceHex,
  type Address,
  type Hex,
} from "viem";

// Coinbase Smart Wallet v1.1 values used by @base-org/account 2.2.0.
// Sources:
// https://github.com/coinbase/smart-wallet/blob/main/src/CoinbaseSmartWalletFactory.sol
// https://github.com/coinbase/smart-wallet/blob/main/src/CoinbaseSmartWallet.sol
export const BASE_ACCOUNT_FACTORY_ADDRESS = getAddress(
  "0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842"
);
export const BASE_ACCOUNT_V1_IMPLEMENTATION_ADDRESS = getAddress(
  "0x00000110dCdEdC9581cb5eCB8467282f2926534d"
);
export const ENTRY_POINT_V06_ADDRESS = getAddress(
  "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
);

// keccak256 of the canonical Solady ERC1967 proxy runtime deployed by the v1.1
// CoinbaseSmartWalletFactory on Base and Base Sepolia.
export const BASE_ACCOUNT_PROXY_RUNTIME_HASH =
  "0xaaa52c8cc8a0e3fd27ce756cc6b4e70c51423e9b597b11f32d3e49f8b1fc890d" as const;

const coinbaseExecuteAbi = [
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

const coinbaseExecuteBatchAbi = [
  {
    type: "function",
    name: "executeBatch",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
] as const;

export const baseAccountFactoryAbi = [
  {
    type: "function",
    name: "createAccount",
    stateMutability: "payable",
    inputs: [
      { name: "owners", type: "bytes[]" },
      { name: "nonce", type: "uint256" },
    ],
    outputs: [{ name: "account", type: "address" }],
  },
  {
    type: "function",
    name: "getAddress",
    stateMutability: "view",
    inputs: [
      { name: "owners", type: "bytes[]" },
      { name: "nonce", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "implementation",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const baseAccountIntrospectionAbi = [
  {
    type: "function",
    name: "implementation",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "entryPoint",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const badgeClaimAbi = [
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

type SponsoredCall = {
  target: Address;
  value: bigint;
  data: Hex;
};

export type PaymasterRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: "pm_getPaymasterStubData" | "pm_getPaymasterData";
  params: readonly unknown[];
};

export type ParsedPaymasterUserOperation = {
  sender: Address;
  callData: Hex;
  initCode: Hex;
};

export type PaymasterGrantShape = {
  account: Address;
  contractAddress: Address;
  chainId: number;
  tokenId: string;
  nonce: string;
  expiresAt: number;
  claimCallDataHash: Hex;
};

export type ParsedBaseAccountDeployment =
  | { kind: "deployed" }
  | { kind: "counterfactual"; owners: readonly Hex[]; nonce: bigint };

export type BaseAccountReader = {
  getBytecode(address: Address): Promise<Hex | undefined>;
  getFactoryImplementation(): Promise<Address>;
  getAccountImplementation(address: Address): Promise<Address>;
  getAccountEntryPoint(address: Address): Promise<Address>;
  getCounterfactualAddress(
    owners: readonly Hex[],
    nonce: bigint
  ): Promise<Address>;
};

const UNSUPPORTED_USER_OPERATION_FIELDS = [
  "factory",
  "factoryData",
  "paymaster",
  "paymasterData",
  "paymasterVerificationGasLimit",
  "paymasterPostOpGasLimit",
  "eip7702Auth",
  "authorization",
  "authorizationList",
] as const;

function decodeCoinbaseExecute(callData: Hex): SponsoredCall[] | null {
  try {
    const decoded = decodeFunctionData({ abi: coinbaseExecuteAbi, data: callData });
    const [target, value, data] = decoded.args;
    return [{ target: getAddress(target), value, data }];
  } catch {
    return null;
  }
}

function decodeCoinbaseExecuteBatch(callData: Hex): SponsoredCall[] | null {
  try {
    const decoded = decodeFunctionData({
      abi: coinbaseExecuteBatchAbi,
      data: callData,
    });
    const [calls] = decoded.args;
    return calls.map((call) => ({
      target: getAddress(call.target),
      value: call.value,
      data: call.data,
    }));
  } catch {
    return null;
  }
}

function decodeSponsoredCalls(callData: Hex): SponsoredCall[] | null {
  return decodeCoinbaseExecute(callData) || decodeCoinbaseExecuteBatch(callData);
}

function parseRequest(value: unknown): PaymasterRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const candidate = value as Partial<PaymasterRequest>;
  const hasValidId =
    candidate.id === undefined ||
    candidate.id === null ||
    typeof candidate.id === "string" ||
    (typeof candidate.id === "number" && Number.isFinite(candidate.id));
  if (
    candidate.jsonrpc !== "2.0" ||
    !hasValidId ||
    (candidate.method !== "pm_getPaymasterStubData" &&
      candidate.method !== "pm_getPaymasterData") ||
    !Array.isArray(candidate.params) ||
    (candidate.params.length !== 3 &&
      !(candidate.params.length === 4 && candidate.params[3] == null))
  ) {
    return null;
  }

  // Reconstruct the JSON-RPC request so only the fields validated here are
  // forwarded upstream. This also removes duplicate-key/parser ambiguity after
  // the route's single JSON.parse pass.
  return {
    jsonrpc: "2.0",
    ...(candidate.id !== undefined ? { id: candidate.id } : {}),
    method: candidate.method,
    params: candidate.params,
  };
}

function parseUserOperation(value: unknown): ParsedPaymasterUserOperation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const candidate = value as Record<string, unknown>;
  if (UNSUPPORTED_USER_OPERATION_FIELDS.some((field) => field in candidate)) {
    return null;
  }
  if (
    typeof candidate.sender !== "string" ||
    !isAddress(candidate.sender, { strict: false }) ||
    typeof candidate.callData !== "string" ||
    !isHex(candidate.callData) ||
    typeof candidate.initCode !== "string" ||
    !isHex(candidate.initCode)
  ) {
    return null;
  }

  return {
    sender: getAddress(candidate.sender),
    callData: candidate.callData,
    initCode: candidate.initCode,
  };
}

function parseChainId(value: unknown): number | null {
  try {
    if (typeof value === "number" && Number.isSafeInteger(value)) return value;
    if (typeof value === "string" && /^(0x[0-9a-fA-F]+|\d+)$/.test(value)) {
      const parsed = Number(BigInt(value));
      return Number.isSafeInteger(parsed) ? parsed : null;
    }
    return null;
  } catch {
    return null;
  }
}

function isExactBadgeClaim(call: SponsoredCall, grant: PaymasterGrantShape) {
  if (
    !isAddressEqual(call.target, grant.contractAddress) ||
    call.value !== BigInt(0) ||
    keccak256(call.data).toLowerCase() !== grant.claimCallDataHash.toLowerCase()
  ) {
    return false;
  }

  try {
    const decoded = decodeFunctionData({ abi: badgeClaimAbi, data: call.data });
    const [tokenId, nonce, deadline] = decoded.args;
    return (
      tokenId.toString() === grant.tokenId &&
      nonce.toString() === grant.nonce &&
      deadline === BigInt(grant.expiresAt)
    );
  } catch {
    return false;
  }
}

export function parseBaseAccountDeployment(
  initCode: Hex
): ParsedBaseAccountDeployment | null {
  if (initCode === "0x") return { kind: "deployed" };
  if (size(initCode) <= 20) return null;

  try {
    const factory = getAddress(sliceHex(initCode, 0, 20));
    if (!isAddressEqual(factory, BASE_ACCOUNT_FACTORY_ADDRESS)) return null;

    const factoryData = sliceHex(initCode, 20);
    const decoded = decodeFunctionData({
      abi: baseAccountFactoryAbi,
      data: factoryData,
    });
    if (decoded.functionName !== "createAccount") return null;

    const [owners, nonce] = decoded.args;
    if (
      owners.length < 1 ||
      owners.length > 8 ||
      owners.some((owner) => size(owner) !== 32 && size(owner) !== 64)
    ) {
      return null;
    }

    return { kind: "counterfactual", owners, nonce };
  } catch {
    return null;
  }
}

export function validatePaymasterRequestShape(
  body: unknown,
  grant: PaymasterGrantShape
):
  | {
      allowed: true;
      request: PaymasterRequest;
      userOperation: ParsedPaymasterUserOperation;
      deployment: ParsedBaseAccountDeployment;
    }
  | { allowed: false } {
  const request = parseRequest(body);
  if (!request) return { allowed: false };

  const userOperation = parseUserOperation(request.params[0]);
  const entryPoint = request.params[1];
  const chainId = parseChainId(request.params[2]);
  if (
    !userOperation ||
    !isAddressEqual(userOperation.sender, grant.account) ||
    typeof entryPoint !== "string" ||
    !isAddress(entryPoint, { strict: false }) ||
    !isAddressEqual(getAddress(entryPoint), ENTRY_POINT_V06_ADDRESS) ||
    chainId !== grant.chainId
  ) {
    return { allowed: false };
  }

  const calls = decodeSponsoredCalls(userOperation.callData);
  const deployment = parseBaseAccountDeployment(userOperation.initCode);
  if (
    !calls ||
    calls.length !== 1 ||
    !isExactBadgeClaim(calls[0], grant) ||
    !deployment
  ) {
    return { allowed: false };
  }

  return { allowed: true, request, userOperation, deployment };
}

function hasCode(code: Hex | undefined): code is Hex {
  return Boolean(code && code !== "0x");
}

export async function attestBaseAccountSender(
  sender: Address,
  deployment: ParsedBaseAccountDeployment,
  reader: BaseAccountReader
): Promise<boolean> {
  try {
    const [factoryCode, factoryImplementation] = await Promise.all([
      reader.getBytecode(BASE_ACCOUNT_FACTORY_ADDRESS),
      reader.getFactoryImplementation(),
    ]);
    if (
      !hasCode(factoryCode) ||
      !isAddressEqual(
        factoryImplementation,
        BASE_ACCOUNT_V1_IMPLEMENTATION_ADDRESS
      )
    ) {
      return false;
    }

    const implementationCode = await reader.getBytecode(
      BASE_ACCOUNT_V1_IMPLEMENTATION_ADDRESS
    );
    if (!hasCode(implementationCode)) return false;

    if (deployment.kind === "counterfactual") {
      const [senderCode, expectedSender] = await Promise.all([
        reader.getBytecode(sender),
        reader.getCounterfactualAddress(deployment.owners, deployment.nonce),
      ]);

      return !hasCode(senderCode) && isAddressEqual(expectedSender, sender);
    }

    const [senderCode, accountImplementation, accountEntryPoint] =
      await Promise.all([
        reader.getBytecode(sender),
        reader.getAccountImplementation(sender),
        reader.getAccountEntryPoint(sender),
      ]);

    return Boolean(
      hasCode(senderCode) &&
        keccak256(senderCode) === BASE_ACCOUNT_PROXY_RUNTIME_HASH &&
        isAddressEqual(
          accountImplementation,
          BASE_ACCOUNT_V1_IMPLEMENTATION_ADDRESS
        ) &&
        isAddressEqual(accountEntryPoint, ENTRY_POINT_V06_ADDRESS)
    );
  } catch {
    // RPC errors and undecodable contracts are not evidence of a Base Account.
    return false;
  }
}
