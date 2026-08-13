export const ZORA_TRADE_EOA_ONLY_MESSAGE =
  "Zora trading currently requires an EOA wallet. Connect MetaMask, Brave Wallet, or another injected wallet instead of Base Account.";

const SUPPORTED_EOA_CONNECTOR_IDS = new Set(["injected"]);

/**
 * Zora Coins SDK 0.4.x/0.5.x trading uses EOA permit signatures and does not
 * support ERC-4337 smart wallets. Keep this allow-list fail-closed so a new
 * connector cannot silently reach the write path without explicit review.
 *
 * @param {string | null | undefined} connectorId
 */
export function isZoraTradeWalletSupported(connectorId) {
  return Boolean(
    connectorId && SUPPORTED_EOA_CONNECTOR_IDS.has(connectorId),
  );
}

/**
 * @param {string | null | undefined} connectorId
 */
export function assertZoraTradeWalletSupported(connectorId) {
  if (!isZoraTradeWalletSupported(connectorId)) {
    throw new Error(ZORA_TRADE_EOA_ONLY_MESSAGE);
  }
}

/**
 * viem resolves waitForTransactionReceipt for both successful and reverted
 * transactions. A hash alone is therefore not evidence that a trade worked.
 *
 * @template {{ status?: string, transactionHash?: string }} T
 * @param {T | null | undefined} receipt
 * @returns {T}
 */
export function assertSuccessfulZoraTradeReceipt(receipt) {
  if (!receipt || receipt.status !== "success") {
    const transactionSuffix = receipt?.transactionHash
      ? ` Transaction: ${receipt.transactionHash}`
      : "";
    throw new Error(`Zora trade reverted on Base.${transactionSuffix}`);
  }

  return receipt;
}
