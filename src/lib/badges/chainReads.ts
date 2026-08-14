import "server-only";

import type { Address } from "viem";

import { drawCoinMissionBadgesAbi } from "@/lib/badges/abi";
import {
  BadgeRpcUnavailableError,
  type BadgeRuntimeConfig,
} from "@/lib/badges/config";

function claimStateContract(
  config: BadgeRuntimeConfig,
  account: Address,
  tokenId: bigint
) {
  return {
    address: config.contractAddress,
    abi: drawCoinMissionBadgesAbi,
    functionName: "claimed" as const,
    args: [account, tokenId] as const,
  };
}

async function readOrThrow<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new BadgeRpcUnavailableError();
  }
}

export function readBadgeClaimStates(
  config: BadgeRuntimeConfig,
  account: Address,
  tokenIds: bigint[]
): Promise<readonly boolean[]> {
  return readOrThrow(() =>
    config.publicClient.multicall({
      contracts: tokenIds.map((tokenId) =>
        claimStateContract(config, account, tokenId)
      ),
      allowFailure: false,
    })
  );
}

export async function readBadgeVoucherState(
  config: BadgeRuntimeConfig,
  account: Address,
  tokenId: bigint
) {
  const [claimSigner, nonce, claimed] = await readOrThrow(() =>
    config.publicClient.multicall({
      contracts: [
        {
          address: config.contractAddress,
          abi: drawCoinMissionBadgesAbi,
          functionName: "claimSigner",
        },
        {
          address: config.contractAddress,
          abi: drawCoinMissionBadgesAbi,
          functionName: "nonces",
          args: [account],
        },
        claimStateContract(config, account, tokenId),
      ],
      allowFailure: false,
    })
  );

  return { claimSigner, nonce, claimed };
}

export async function readBadgeReconciliationState(
  config: BadgeRuntimeConfig,
  account: Address,
  tokenId: bigint
) {
  const [claimed, balance, nonce] = await readOrThrow(() =>
    config.publicClient.multicall({
      contracts: [
        claimStateContract(config, account, tokenId),
        {
          address: config.contractAddress,
          abi: drawCoinMissionBadgesAbi,
          functionName: "balanceOf",
          args: [account, tokenId],
        },
        {
          address: config.contractAddress,
          abi: drawCoinMissionBadgesAbi,
          functionName: "nonces",
          args: [account],
        },
      ],
      allowFailure: false,
    })
  );

  return { claimed, balance, nonce };
}
