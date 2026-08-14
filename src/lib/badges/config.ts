import "server-only";

import {
  createPublicClient,
  fallback,
  getAddress,
  http,
  isAddress,
  type Address,
} from "viem";
import { base, baseSepolia } from "viem/chains";

export const SUPPORTED_BADGE_CHAIN_IDS = [base.id, baseSepolia.id] as const;

export class BadgeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadgeConfigurationError";
  }
}

export class BadgeRpcUnavailableError extends Error {
  constructor() {
    super("Base RPC is temporarily unavailable.");
    this.name = "BadgeRpcUnavailableError";
  }
}

export type BadgeRuntimeConfig = ReturnType<typeof getBadgeRuntimeConfig>;

function parseChainId(): (typeof SUPPORTED_BADGE_CHAIN_IDS)[number] {
  const rawChainId = process.env.BADGE_CONTRACT_CHAIN_ID?.trim() || String(base.id);
  const chainId = Number(rawChainId);

  if (chainId !== base.id && chainId !== baseSepolia.id) {
    throw new BadgeConfigurationError(
      `BADGE_CONTRACT_CHAIN_ID must be ${base.id} (Base) or ${baseSepolia.id} (Base Sepolia).`
    );
  }

  return chainId;
}

function parseContractAddress(): Address {
  const serverAddress = process.env.BADGE_CONTRACT_ADDRESS?.trim();
  const publicAddress = process.env.NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS?.trim();
  const rawAddress = serverAddress || publicAddress;

  if (
    (serverAddress && !isAddress(serverAddress, { strict: false })) ||
    (publicAddress && !isAddress(publicAddress, { strict: false }))
  ) {
    throw new BadgeConfigurationError("Badge contract address configuration is invalid.");
  }
  if (!rawAddress || !isAddress(rawAddress, { strict: false })) {
    throw new BadgeConfigurationError("A valid BADGE_CONTRACT_ADDRESS is required.");
  }

  if (
    serverAddress &&
    publicAddress &&
    isAddress(serverAddress, { strict: false }) &&
    isAddress(publicAddress, { strict: false }) &&
    getAddress(serverAddress) !== getAddress(publicAddress)
  ) {
    throw new BadgeConfigurationError(
      "BADGE_CONTRACT_ADDRESS and NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS must match."
    );
  }

  return getAddress(rawAddress);
}

function parseVoucherTtl(): number {
  const requestedTtl = Number(process.env.BADGE_CLAIM_VOUCHER_TTL_SECONDS || "600");
  if (!Number.isFinite(requestedTtl)) return 600;
  return Math.min(900, Math.max(60, Math.floor(requestedTtl)));
}

function parseOptionalRpcUrl(name: string): string | undefined {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) return undefined;

  try {
    const url = new URL(rawValue);
    if (url.protocol !== "https:") throw new Error("HTTPS is required");
    return url.toString();
  } catch {
    throw new BadgeConfigurationError(`${name} must be a valid HTTPS RPC URL.`);
  }
}

export function getBadgeRuntimeConfig() {
  const chainId = parseChainId();
  const chain = chainId === base.id ? base : baseSepolia;
  const primaryRpcUrl =
    parseOptionalRpcUrl("BADGE_RPC_URL") ||
    parseOptionalRpcUrl("BASE_RPC_URL");
  const fallbackRpcUrl = parseOptionalRpcUrl("BADGE_RPC_FALLBACK_URL");
  const primaryTransport = http(primaryRpcUrl, {
    timeout: 5_000,
    retryCount: 0,
  });
  const rpcTransport =
    fallbackRpcUrl && fallbackRpcUrl !== primaryRpcUrl
      ? fallback(
          [
            primaryTransport,
            http(fallbackRpcUrl, { timeout: 5_000, retryCount: 0 }),
          ],
          { rank: false, retryCount: 0 }
        )
      : primaryTransport;

  return {
    chainId,
    contractAddress: parseContractAddress(),
    publicClient: createPublicClient({
      chain,
      transport: rpcTransport,
    }),
    voucherTtlSeconds: parseVoucherTtl(),
  };
}

export function getBadgeConfigurationStatus():
  | {
      configured: true;
      chainId: (typeof SUPPORTED_BADGE_CHAIN_IDS)[number];
      contractAddress: Address;
    }
  | { configured: false; reason: string } {
  try {
    const config = getBadgeRuntimeConfig();
    return {
      configured: true,
      chainId: config.chainId,
      contractAddress: config.contractAddress,
    };
  } catch (error) {
    return {
      configured: false,
      reason:
        error instanceof BadgeConfigurationError
          ? error.message
          : "Badge contract configuration is invalid.",
    };
  }
}
