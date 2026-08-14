/**
 * @fileoverview Service functions for creating Zora coins
 * @module createCoin
 */

import {
  createCoinCall,
  getCoinCreateFromLogs,
  CreateConstants,
} from "@zoralabs/coins-sdk";
import { coinFactoryAddress } from "@zoralabs/protocol-deployments";
import { isAddressEqual } from "viem";
import { base, baseSepolia } from "viem/chains";
import { normalizeAdditionalOwners } from "../../lib/create/additionalOwners.js";
import { assertIpfsMetadataURI } from "../../lib/create/metadataUri.js";
import { showError } from "../../utils/toastUtils";

export { normalizeAdditionalOwners };

/**
 * Creates a Zora coin using the updated SDK's createCoin function
 * @param {Object} params - Coin creation parameters
 * @param {string} params.name - Name of the coin
 * @param {string} params.symbol - Trading symbol for the coin
 * @param {string} params.uri - Metadata URI (IPFS URI recommended)
 * @param {string} params.payoutRecipient - Address that receives creator earnings
 * @param {Array<string>} [params.owners] - Optional array of owner addresses
 * @param {string} [params.platformReferrer] - Optional platform referrer address for earning referral fees
 * @param {string} [params.currency] - Optional currency ("ETH", "ZORA", "CREATOR_COIN", or "CREATOR_COIN_OR_ZORA")
 * @param {number} [params.chainId] - Optional chain ID (defaults to current wallet chain)
 * @param {Object} walletClient - Viem wallet client
 * @param {Object} publicClient - Viem public client
 * @param {(call: {to: `0x${string}`, data: `0x${string}`, value: bigint}) => Promise<`0x${string}`>} sendPreparedCall
 * Base-aware wallet transport. Uses wallet_sendCalls when supported and an
 * eth_sendTransaction fallback otherwise.
 * @returns {Promise<object>} Transaction result with hash, receipt, and coin address
 */
export async function createZoraCoin(
  {
    name,
    symbol,
    uri,
    payoutRecipient,
    owners = [],
    platformReferrer,
    currency,
    chainId,
  },
  walletClient,
  publicClient,
  sendPreparedCall,
) {
  try {
    if (!name || !symbol || !uri || !payoutRecipient) {
      throw new Error(
        "Required parameters missing: name, symbol, uri, and payoutRecipient are required",
      );
    }

    if (!walletClient || !publicClient) {
      throw new Error("Wallet client and public client are required");
    }
    if (typeof sendPreparedCall !== "function") {
      throw new Error("A Base-compatible transaction sender is required");
    }

    // Get wallet chain ID or use provided chainId
    const walletChainId = await walletClient.getChainId();
    const targetChainId = chainId || walletChainId;

    // Validate Base network (optional - remove if you want to support other chains)
    if (targetChainId === base.id && walletChainId !== base.id) {
      showError(
        `You're connected to network ID ${walletChainId}, but Base network (${base.id}) is required. Please switch networks.`,
        "network validation",
      );

      throw new Error(
        `Chain mismatch: Connected to chain ${walletChainId}, but Base (${base.id}) is required. Please switch networks.`,
      );
    }

    // Determine currency - use new SDK constants
    let selectedCurrency = currency;
    if (selectedCurrency === undefined || selectedCurrency === null) {
      // Follow SDK defaults strictly: Base mainnet defaults to ZORA currency
      selectedCurrency =
        targetChainId === base.id
          ? CreateConstants.ContentCoinCurrencies.ZORA
          : CreateConstants.ContentCoinCurrencies.ETH;
    }

    const metadataURI = assertIpfsMetadataURI(uri);
    const additionalOwners = normalizeAdditionalOwners(owners, payoutRecipient);

    // Prepare coin parameters according to the Coins SDK content-coin format.
    const coinParams = {
      creator: payoutRecipient, // New SDK requires 'creator' field
      name,
      symbol,
      metadata: { type: "RAW_URI", uri: metadataURI },
      currency: selectedCurrency,
      ...(chainId && { chainId }),
      ...(platformReferrer && { platformReferrer }),
      ...(additionalOwners.length > 0 && { additionalOwners }),
      ...(payoutRecipient && { payoutRecipientOverride: payoutRecipient }), // New field name
      skipMetadataValidation: true, // Skip SDK validation since we already uploaded to IPFS
      // Note: initialPurchase is no longer supported in new SDK
      // Users will need to make separate purchase after creation
    };

    // Ask Zora only for the canonical factory call. The SDK 0.4.1 high-level
    // createCoin helper estimates an exact gas limit before Wagmi appends the
    // ERC-8021 Builder Code suffix. Base App then simulates a different final
    // transaction and can reject it as underfunded. Sending the prepared call
    // through Wagmi's EIP-5792 flow lets the wallet estimate the final payload.
    const callRequest = await createCoinCall({
      ...coinParams,
      chainId: targetChainId,
    });

    if (callRequest.calls.length !== 1 || !callRequest.calls[0]) {
      throw new Error("Zora returned an unsupported creation request");
    }

    const preparedCall = callRequest.calls[0];
    const officialFactory = coinFactoryAddress[targetChainId];
    if (
      !officialFactory ||
      !isAddressEqual(preparedCall.to, officialFactory)
    ) {
      throw new Error("Zora returned an unexpected factory address");
    }
    if (preparedCall.value !== BigInt(0)) {
      throw new Error("Token creation returned an unexpected payment request");
    }

    // Fail before opening the wallet when the same direct factory call cannot
    // execute from the creator address. This is validation only; gas is left to
    // the wallet because it must include Base Account wrapping and dataSuffix.
    await publicClient.call({
      ...preparedCall,
      account: payoutRecipient,
    });

    const hash = await sendPreparedCall(preparedCall);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error("The Base token creation transaction reverted");
    }

    const deployment = getCoinCreateFromLogs(receipt);
    if (!deployment?.coin) {
      throw new Error("The Zora creation event was not found in the receipt");
    }
    if (
      callRequest.predictedCoinAddress &&
      !isAddressEqual(deployment.coin, callRequest.predictedCoinAddress)
    ) {
      // The receipt is canonical after a successful official-factory call.
      // Do not turn a completed onchain creation into a retryable UI failure;
      // the server record route independently verifies the same receipt.
      console.warn("Zora predicted address differed from the receipt event.");
    }

    const chain =
      targetChainId === base.id
        ? base
        : targetChainId === baseSepolia.id
          ? baseSepolia
          : publicClient.chain;

    return {
      hash,
      receipt,
      address: deployment.coin,
      deployment,
      chain,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown token creation error";
    console.error("Error creating coin:", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: errorMessage,
    });

    // Provide more specific error messages
    if (errorMessage.includes("execution reverted")) {
      throw new Error(
        "The Base transaction simulation failed. No transaction was sent.",
      );
    } else if (errorMessage.includes("user rejected")) {
      throw new Error("Token creation was rejected");
    } else if (
      errorMessage.includes("rejected") ||
      errorMessage.includes("denied")
    ) {
      throw new Error("Token creation was rejected");
    } else if (
      errorMessage.includes("cancelled") ||
      errorMessage.includes("canceled")
    ) {
      throw new Error("Token creation was cancelled");
    } else if (errorMessage.includes("insufficient funds")) {
      throw new Error("Insufficient funds for transaction including gas fees");
    } else if (errorMessage.includes("Invalid metadata URI")) {
      throw new Error(`Invalid token metadata: ${errorMessage}`);
    } else {
      throw new Error(`Failed to create token: ${errorMessage}`);
    }
  }
}

/**
 * Helper function to get coin address from transaction receipt logs
 * @param {Object} receipt - Transaction receipt
 * @returns {string|null} Deployed coin address or null if not found
 */
export function getCoinAddressFromReceipt(receipt) {
  try {
    const coinDeployment = getCoinCreateFromLogs(receipt);
    return coinDeployment?.coin || null;
  } catch (error) {
    console.error("Error extracting coin address from receipt:", error);
    return null;
  }
}

// Export the new SDK constants for consistency
export { CreateConstants };
