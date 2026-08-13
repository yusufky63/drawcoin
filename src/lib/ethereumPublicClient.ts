import "server-only";

import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

let ethereumPublicClient:
  | ReturnType<typeof createPublicClient>
  | undefined;

export function isEthereumPublicClientConfigured() {
  return Boolean(process.env.ETHEREUM_RPC_URL?.trim());
}

export function getEthereumPublicClient() {
  const rpcUrl = process.env.ETHEREUM_RPC_URL?.trim();
  if (!rpcUrl) {
    throw new Error(
      "ETHEREUM_RPC_URL is required for ENSIP-19 Basename resolution."
    );
  }

  ethereumPublicClient ??= createPublicClient({
    chain: mainnet,
    // Identity enrichment must never hold up the global header. Basenames are
    // optional, so use a short, non-retrying RPC transport and fall back to
    // the wallet address when the provider is slow.
    transport: http(rpcUrl, { retryCount: 0, timeout: 2_500 }),
  });

  return ethereumPublicClient;
}
