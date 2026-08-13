import { base, baseSepolia } from "viem/chains";

export type WalletSessionChainId = typeof base.id | typeof baseSepolia.id;

export function isWalletSessionChainAllowed(
  chainId: number,
  nodeEnvironment: string | undefined = process.env.NODE_ENV,
  enableSepoliaFlag: string | undefined =
    process.env.NEXT_PUBLIC_ENABLE_BASE_SEPOLIA
): chainId is WalletSessionChainId {
  if (chainId === base.id) return true;

  const enableSepolia =
    enableSepoliaFlag === "true" ||
    (enableSepoliaFlag === undefined && nodeEnvironment !== "production");

  return enableSepolia && chainId === baseSepolia.id;
}
