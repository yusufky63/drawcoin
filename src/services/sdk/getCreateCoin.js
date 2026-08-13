/**
 * @fileoverview Service functions for creating Zora coins
 * @module createCoin
 */

import {
  createCoin,
  getCoinCreateFromLogs,
  CreateConstants,
} from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
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

    // Wagmi's Base client appends the ERC-8021 Builder Code data suffix.
    const result = await createCoin({
      call: coinParams,
      walletClient,
      publicClient: publicClient,
      options: {
        skipValidateTransaction: false, // Enable validation to get proper gas estimate
      },
    });

    return result;
  } catch (error) {
    console.error("Error creating coin:", error);

    // Provide more specific error messages
    if (error.message && error.message.includes("execution reverted")) {
      throw new Error(
        "Contract execution failed. This might be due to insufficient funds, invalid parameters, or network congestion. Please try again with a higher gas limit or check your wallet balance.",
      );
    } else if (error.message && error.message.includes("user rejected")) {
      throw new Error("Token creation was rejected");
    } else if (
      (error.message && error.message.includes("rejected")) ||
      error.message?.includes("denied")
    ) {
      throw new Error("Token creation was rejected");
    } else if (
      (error.message && error.message.includes("cancelled")) ||
      error.message?.includes("canceled")
    ) {
      throw new Error("Token creation was cancelled");
    } else if (error.message && error.message.includes("insufficient funds")) {
      throw new Error("Insufficient funds for transaction including gas fees");
    } else if (
      error.message &&
      error.message.includes("Invalid metadata URI")
    ) {
      throw new Error(`Invalid token metadata: ${error.message}`);
    } else {
      throw new Error(`Failed to create token: ${error.message}`);
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
