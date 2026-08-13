/**
 * @fileoverview Base Builder Codes (ERC-8021) utility
 * Provides dataSuffix for attributing DrawCoin transactions on Base.
 * @see https://docs.base.org/apps/builder-codes/app-developers
 */

import { Attribution } from "ox/erc8021";

// Builder Code from base.dev → Settings → Builder Code
const BUILDER_CODE = process.env.NEXT_PUBLIC_BUILDER_CODE || "bc_ekz1rx82";

/**
 * Pre-computed ERC-8021 dataSuffix for DrawCoin.
 * Appended to every transaction calldata so Base can attribute
 * onchain activity back to this app (rewards, analytics, visibility).
 */
export const DATA_SUFFIX = Attribution.toDataSuffix({
  codes: [BUILDER_CODE],
});

/**
 * Returns the ERC-8021 dataSuffix hex string.
 * Use this when sending transactions manually via walletClient.
 */
export function getBuilderCodeSuffix(): `0x${string}` {
  return DATA_SUFFIX;
}
