import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  encodeFunctionData,
  getAddress,
  isAddress,
  isHash,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  BADGE_EIP712_NAME,
  BADGE_EIP712_VERSION,
  badgeClaimTypes,
  drawCoinMissionBadgesAbi,
} from "@/lib/badges/abi";
import {
  BadgeConfigurationError,
  getBadgeRuntimeConfig,
} from "@/lib/badges/config";
import {
  issuePaymasterGrant,
  type PaymasterGrantRecord,
} from "@/lib/badges/paymasterGrantStore";

const PRIVATE_KEY_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PAYMASTER_TOKEN_VERSION = 2;

export type BadgeClaimVoucher = {
  account: Address;
  tokenId: bigint;
  nonce: bigint;
  deadline: bigint;
  signature: Hex;
  callData: Hex;
  chainId: number;
  contractAddress: Address;
};

export type PaymasterGrant = PaymasterGrantRecord & {
  version: typeof PAYMASTER_TOKEN_VERSION;
};

function isPaymasterProxyExplicitlyEnabled(): boolean {
  return process.env.PAYMASTER_PROXY_ENABLED?.trim().toLowerCase() === "true";
}

function normalizePrivateKey(rawValue: string | undefined): Hex | null {
  let value = rawValue?.trim();
  if (!value) return null;

  const hasMatchingQuotes =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));
  if (hasMatchingQuotes) value = value.slice(1, -1).trim();

  if (/^[0-9a-fA-F]{64}$/.test(value)) value = `0x${value}`;
  return PRIVATE_KEY_PATTERN.test(value) ? (value as Hex) : null;
}

function getClaimSigner() {
  const privateKey = normalizePrivateKey(process.env.PRIVATE_KEY);
  if (!privateKey) {
    throw new BadgeConfigurationError(
      "PRIVATE_KEY must contain exactly 64 hexadecimal characters, with an optional 0x prefix."
    );
  }

  return privateKeyToAccount(privateKey as Hex);
}

function getPaymasterTokenSecret(): string | null {
  const secret = process.env.PAYMASTER_PROXY_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

function getPaymasterServiceUrl(): URL | null {
  const rawUrl = process.env.BASE_PAYMASTER_SERVICE_URL?.trim();
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    const isLocalDevelopment =
      process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");

    if (url.protocol !== "https:" && !isLocalDevelopment) return null;
    return url;
  } catch {
    return null;
  }
}

export function getPaymasterConfigurationStatus():
  | { configured: true }
  | { configured: false; reason: string } {
  if (!isPaymasterProxyExplicitlyEnabled()) {
    return {
      configured: false,
      reason:
        "Gas sponsorship is disabled until PAYMASTER_PROXY_ENABLED is explicitly set to true.",
    };
  }

  if (!getPaymasterServiceUrl()) {
    return {
      configured: false,
      reason: "BASE_PAYMASTER_SERVICE_URL is not configured with a valid HTTPS endpoint.",
    };
  }

  if (!getPaymasterTokenSecret()) {
    return {
      configured: false,
      reason: "PAYMASTER_PROXY_SECRET must contain at least 32 characters.",
    };
  }

  return { configured: true };
}

export function getConfiguredPaymasterServiceUrl(): URL {
  if (!isPaymasterProxyExplicitlyEnabled()) {
    throw new BadgeConfigurationError("Gas sponsorship is explicitly disabled.");
  }

  const url = getPaymasterServiceUrl();
  if (!url) {
    throw new BadgeConfigurationError(
      "BASE_PAYMASTER_SERVICE_URL is not configured with a valid HTTPS endpoint."
    );
  }
  return url;
}

export async function createBadgeClaimVoucher(
  accountAddress: Address,
  tokenId: bigint
): Promise<BadgeClaimVoucher> {
  const config = getBadgeRuntimeConfig();
  const account = getAddress(accountAddress);
  const signer = getClaimSigner();

  const contractCode = await config.publicClient.getBytecode({
    address: config.contractAddress,
  });
  if (!contractCode || contractCode === "0x") {
    throw new BadgeConfigurationError(
      "BADGE_CONTRACT_ADDRESS does not contain deployed contract code on the configured chain."
    );
  }

  const [contractSigner, nonce, wasClaimed] = await Promise.all([
    config.publicClient.readContract({
      address: config.contractAddress,
      abi: drawCoinMissionBadgesAbi,
      functionName: "claimSigner",
    }),
    config.publicClient.readContract({
      address: config.contractAddress,
      abi: drawCoinMissionBadgesAbi,
      functionName: "nonces",
      args: [account],
    }),
    config.publicClient.readContract({
      address: config.contractAddress,
      abi: drawCoinMissionBadgesAbi,
      functionName: "claimed",
      args: [account, tokenId],
    }),
  ]);

  if (getAddress(contractSigner) !== signer.address) {
    throw new BadgeConfigurationError(
      "The configured claim signer does not match claimSigner() on the badge contract."
    );
  }
  if (wasClaimed) {
    throw new BadgeAlreadyClaimedError();
  }

  const deadline = BigInt(
    Math.floor(Date.now() / 1000) + config.voucherTtlSeconds
  );
  const signature = await signer.signTypedData({
    domain: {
      name: BADGE_EIP712_NAME,
      version: BADGE_EIP712_VERSION,
      chainId: config.chainId,
      verifyingContract: config.contractAddress,
    },
    types: badgeClaimTypes,
    primaryType: "Claim",
    message: {
      account,
      tokenId,
      nonce,
      deadline,
    },
  });
  const callData = encodeFunctionData({
    abi: drawCoinMissionBadgesAbi,
    functionName: "claim",
    args: [tokenId, nonce, deadline, signature],
  });

  return {
    account,
    tokenId,
    nonce,
    deadline,
    signature,
    callData,
    chainId: config.chainId,
    contractAddress: config.contractAddress,
  };
}

export class BadgeAlreadyClaimedError extends Error {
  constructor() {
    super("This mission badge has already been claimed by the connected wallet.");
    this.name = "BadgeAlreadyClaimedError";
  }
}

export async function createPaymasterGrantToken(
  voucher: BadgeClaimVoucher
): Promise<string | null> {
  const secret = getPaymasterTokenSecret();
  if (
    !secret ||
    !getPaymasterServiceUrl() ||
    !isPaymasterProxyExplicitlyEnabled()
  ) {
    return null;
  }

  const grant: PaymasterGrant = {
    version: PAYMASTER_TOKEN_VERSION,
    grantId: randomUUID(),
    account: voucher.account,
    contractAddress: voucher.contractAddress,
    chainId: voucher.chainId,
    tokenId: voucher.tokenId.toString(),
    nonce: voucher.nonce.toString(),
    expiresAt: Number(voucher.deadline),
    claimCallDataHash: keccak256(voucher.callData),
  };
  if (!(await issuePaymasterGrant(grant))) return null;

  const encodedGrant = Buffer.from(JSON.stringify(grant), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(encodedGrant)
    .digest("base64url");

  return `${encodedGrant}.${signature}`;
}

export function verifyPaymasterGrantToken(token: string): PaymasterGrant | null {
  const secret = getPaymasterTokenSecret();
  if (
    !secret ||
    !isPaymasterProxyExplicitlyEnabled() ||
    token.length > 2_048
  ) {
    return null;
  }

  const [encodedGrant, providedSignature, extraPart] = token.split(".");
  if (!encodedGrant || !providedSignature || extraPart) return null;

  const expectedSignature = createHmac("sha256", secret)
    .update(encodedGrant)
    .digest();

  let receivedSignature: Buffer;
  try {
    receivedSignature = Buffer.from(providedSignature, "base64url");
  } catch {
    return null;
  }

  if (
    receivedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(receivedSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedGrant, "base64url").toString("utf8")
    ) as Partial<PaymasterGrant>;
    const chainId = parsed.chainId;
    const expiresAt = parsed.expiresAt;

    if (
      parsed.version !== PAYMASTER_TOKEN_VERSION ||
      typeof parsed.grantId !== "string" ||
      !UUID_PATTERN.test(parsed.grantId) ||
      !parsed.account ||
      !isAddress(parsed.account, { strict: false }) ||
      !parsed.contractAddress ||
      !isAddress(parsed.contractAddress, { strict: false }) ||
      typeof chainId !== "number" ||
      !Number.isSafeInteger(chainId) ||
      typeof parsed.tokenId !== "string" ||
      !/^\d+$/.test(parsed.tokenId) ||
      typeof parsed.nonce !== "string" ||
      !/^\d+$/.test(parsed.nonce) ||
      typeof expiresAt !== "number" ||
      !Number.isSafeInteger(expiresAt) ||
      expiresAt < Math.floor(Date.now() / 1000) ||
      expiresAt > Math.floor(Date.now() / 1000) + 900 ||
      !parsed.claimCallDataHash ||
      !isHash(parsed.claimCallDataHash)
    ) {
      return null;
    }

    return {
      version: PAYMASTER_TOKEN_VERSION,
      grantId: parsed.grantId,
      account: getAddress(parsed.account),
      contractAddress: getAddress(parsed.contractAddress),
      chainId,
      tokenId: parsed.tokenId,
      nonce: parsed.nonce,
      expiresAt,
      claimCallDataHash: parsed.claimCallDataHash,
    };
  } catch {
    return null;
  }
}
