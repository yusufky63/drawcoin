import "server-only";

import {
  encodePacked,
  getAddress,
  keccak256,
  namehash,
  toCoinType,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";

import { basePublicClient } from "@/lib/basePublicClient";
import { normalizeBasename } from "@/lib/creatorIdentity";

const BASENAME_L2_RESOLVER_ADDRESS =
  "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD" as const;

const BASENAME_RESOLVER_ABI = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

/**
 * Basenames use the ENSIP-19 Base coin type under the reverse namespace. This
 * direct L2 lookup is batchable and avoids one Ethereum proof request per card.
 */
export function getBasenameReverseNode(address: Address): Hex {
  const normalized = getAddress(address).toLowerCase().slice(2);
  const addressNode = keccak256(encodePacked(["string"], [normalized]));
  const coinTypeHex = toCoinType(base.id).toString(16).toUpperCase();
  const reverseNode = namehash(`${coinTypeHex}.reverse`);
  return keccak256(
    encodePacked(["bytes32", "bytes32"], [reverseNode, addressNode])
  );
}
export async function resolveBasenamesOnBase(addresses: readonly Address[]) {
  if (addresses.length === 0) return new Map<string, string | null>();

  const results = await basePublicClient.multicall({
    allowFailure: true,
    contracts: addresses.map((address) => ({
      address: BASENAME_L2_RESOLVER_ADDRESS,
      abi: BASENAME_RESOLVER_ABI,
      functionName: "name" as const,
      args: [getBasenameReverseNode(address)] as const,
    })),
  });

  return new Map(
    results.map((result, index) => {
      const address = addresses[index].toLowerCase();
      const basename =
        result.status === "success" && typeof result.result === "string"
          ? normalizeBasename(result.result)
          : null;
      return [address, basename] as const;
    })
  );
}
