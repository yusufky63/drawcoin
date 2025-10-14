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
import { showError } from "../../utils/toastUtils";

/**
 * Creates a Zora coin using the updated SDK's createCoin function
 * @param {Object} params - Coin creation parameters
 * @param {string} params.name - Name of the coin
 * @param {string} params.symbol - Trading symbol for the coin
 * @param {string} params.uri - Metadata URI (IPFS URI recommended)
 * @param {string} params.payoutRecipient - Address that receives creator earnings
 * @param {Array<string>} [params.owners] - Optional array of owner addresses
 * @param {bigint} [params.initialPurchaseWei] - Optional initial purchase amount (for backward compatibility)
 * @param {string} [params.platformReferrer] - Optional platform referrer address for earning referral fees
 * @param {string} [params.currency] - Optional currency ("ETH", "ZORA", "CREATOR_COIN", or "CREATOR_COIN_OR_ZORA")
 * @param {string} [params.startingMarketCap] - Optional starting market cap ("LOW" or "HIGH")
 * @param {string} [params.smartWalletRouting] - Optional smart wallet routing ("AUTO" or "DISABLE")
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
    initialPurchaseWei = 0n,
    platformReferrer,
    currency,
    startingMarketCap,
    smartWalletRouting,
    chainId,
  },
  walletClient,
  publicClient
) {
  try {
    if (!name || !symbol || !uri || !payoutRecipient) {
      throw new Error(
        "Required parameters missing: name, symbol, uri, and payoutRecipient are required"
      );
    }

    if (!walletClient || !publicClient) {
      throw new Error("Wallet client and public client are required");
    }

    // Validate metadata URI content before creating the coin
    // Note: Metadata validation is now handled automatically by the SDK
    console.log("Metadata URI:", uri);

    // Get wallet chain ID or use provided chainId
    const walletChainId = await walletClient.getChainId();
    const targetChainId = chainId || walletChainId;

    // Validate Base network (optional - remove if you want to support other chains)
    if (targetChainId === base.id && walletChainId !== base.id) {
      showError(
        `You're connected to network ID ${walletChainId}, but Base network (${base.id}) is required. Please switch networks.`,
        'network validation'
      );

      throw new Error(
        `Chain mismatch: Connected to chain ${walletChainId}, but Base (${base.id}) is required. Please switch networks.`
      );
    }

    // Determine currency - use new SDK constants
    let selectedCurrency = currency;
    if (selectedCurrency === undefined || selectedCurrency === null) {
      // Follow SDK defaults strictly: Base mainnet defaults to ZORA currency
      selectedCurrency = (targetChainId === base.id)
        ? CreateConstants.ContentCoinCurrencies.ZORA
        : CreateConstants.ContentCoinCurrencies.ETH;
    }

    console.log(
      "Selected currency:",
      selectedCurrency === CreateConstants.ContentCoinCurrencies.ZORA ? "ZORA" : "ETH"
    );

    // Prepare coin parameters according to new SDK v2 format
    const coinParams = {
      creator: payoutRecipient, // New SDK requires 'creator' field
      name,
      symbol,
      metadata: { type: "RAW_URI", uri }, // New SDK requires metadata object
      currency: selectedCurrency,
      ...(startingMarketCap && { startingMarketCap }), // Add starting market cap if provided
      ...(smartWalletRouting && { smartWalletRouting }), // Add smart wallet routing if provided
      ...(chainId && { chainId }),
      ...(platformReferrer && { platformReferrer }),
      ...(owners && owners.length > 0 && { additionalOwners: owners }), // Changed from 'owners' to 'additionalOwners'
      ...(payoutRecipient && { payoutRecipientOverride: payoutRecipient }), // New field name
      skipMetadataValidation: true, // Skip SDK validation since we already uploaded to IPFS
      // Note: initialPurchase is no longer supported in new SDK
      // Users will need to make separate purchase after creation
    };

    // Remove chainId from coinParams as it's already included above
    // The new SDK handles chainId differently

    console.log("=== COIN CREATION PARAMETERS (SDK v2) ===");
    console.log("Creator:", payoutRecipient);
    console.log("Name:", name);
    console.log("Symbol:", symbol);
    console.log("Metadata URI:", uri);
    console.log("Currency:", selectedCurrency === CreateConstants.ContentCoinCurrencies.ZORA ? "ZORA" : "ETH");
    console.log("Starting Market Cap:", startingMarketCap || "Not specified");
    console.log("Smart Wallet Routing:", smartWalletRouting || "Not specified");
    console.log("Platform Referrer:", platformReferrer);
    console.log("Additional Owners:", owners);
    console.log("Chain ID:", chainId);
    console.log("Skip Metadata Validation:", true, "(Already uploaded to IPFS)");
    console.log("Note: Initial purchase is no longer supported in SDK v2");
    console.log("Final coinParams:", coinParams);

    // Fee optimization: Create optimized wallet client for lower gas costs
    const optimizedWalletClient = {
      ...walletClient,
      request: async (args) => {
        if (args.method === 'eth_sendTransaction' && args.params?.[0]) {
          // Remove manual gas settings to let wallet optimize
          const { gasPrice, maxFeePerGas, maxPriorityFeePerGas, ...optimizedParams } = args.params[0];
          
          // Use wallet's optimal gas estimation
          return walletClient.request({
            ...args,
            params: [optimizedParams]
          });
        }
        return walletClient.request(args);
      }
    };

    // Get current gas price for optimization
    const currentGasPrice = await publicClient.getGasPrice();
    console.log("Current gas price:", currentGasPrice.toString(), "wei");
    console.log("Current gas price:", (Number(currentGasPrice) / 1e9).toFixed(2), "gwei");

    // Use the SDK's createCoin function with new parameter structure
    const result = await createCoin({
      call: coinParams,
      walletClient: optimizedWalletClient,
      publicClient: publicClient,
      options: {
        skipValidateTransaction: false, // Enable validation to get proper gas estimate
        gasMultiplier: 1.1, // Use 10% buffer instead of default
      }
    });

    console.log("=== COIN CREATION SUCCESS ===");
    console.log("Transaction Hash:", result.hash);
    console.log("Coin Address:", result.address);
    console.log("Deployment Details:", result.deployment);
    console.log("Full Result:", result);
    
    // Note: Initial purchase handling removed as not supported in SDK v2
    console.log("ℹ️ Initial purchase is no longer supported in SDK v2. Users can purchase tokens separately after creation.");

    return result;
  } catch (error) {
    console.error("Error creating coin:", error);

    // Provide more specific error messages
    if (error.message && error.message.includes("execution reverted")) {
      throw new Error(
        "Contract execution failed. This might be due to insufficient funds, invalid parameters, or network congestion. Please try again with a higher gas limit or check your wallet balance."
      );
    } else if (error.message && error.message.includes("user rejected")) {
      throw new Error("Token creation was rejected");
    } else if (error.message && error.message.includes("rejected") || error.message?.includes("denied")) {
      throw new Error("Token creation was rejected");
    } else if (error.message && error.message.includes("cancelled") || error.message?.includes("canceled")) {
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
