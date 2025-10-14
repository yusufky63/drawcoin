/**
 * @fileoverview Service functions for creating Zora coins
 * @module createCoin
 */

import {
  createCoin,
  validateMetadataURIContent,
  getCoinCreateFromLogs,
  DeployCurrency,
  InitialPurchaseCurrency,
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
 * @param {DeployCurrency} [params.currency] - Optional currency (DeployCurrency.ETH or DeployCurrency.ZORA)
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
    try {
      console.log("Validating metadata URI:", uri);
      await validateMetadataURIContent(uri);
      console.log("✅ Metadata URI validation successful");
    } catch (validationError) {
      console.error("❌ Metadata URI validation failed:", validationError);
      throw new Error(`Invalid metadata URI: ${validationError.message}`);
    }

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

    // Determine currency - use DeployCurrency enum from SDK
    let selectedCurrency = currency;
    if (selectedCurrency === undefined || selectedCurrency === null) {
      // Follow SDK defaults strictly: Base mainnet defaults to ZORA currency
      selectedCurrency = (targetChainId === base.id)
        ? DeployCurrency.ZORA
        : DeployCurrency.ETH;
    }

    console.log(
      "Selected currency:",
      selectedCurrency === DeployCurrency.ZORA ? "ZORA" : "ETH"
    );

    // Prepare coin parameters according to latest SDK docs format
    const coinParams = {
      name,
      symbol,
      uri,
      payoutRecipient,
      currency: selectedCurrency, // Use DeployCurrency enum from SDK
      ...(owners && owners.length > 0 && { owners }), // Only include owners if provided
      ...(platformReferrer && { platformReferrer }), // Only include platformReferrer if provided
      // Map legacy initialPurchaseWei into the SDK's initialPurchase object
      ...(initialPurchaseWei && initialPurchaseWei > 0n && {
        initialPurchase: {
          currency: InitialPurchaseCurrency.ETH,
          amount: initialPurchaseWei,
        }
      }),
    };

    // Include chainId only if it's different from the current wallet chain
    if (chainId && chainId !== walletChainId) {
      coinParams.chainId = chainId;
    }

    console.log("=== COIN CREATION PARAMETERS ===");
    console.log("Name:", name);
    console.log("Symbol:", symbol);
    console.log("URI:", uri);
    console.log("Payout Recipient:", payoutRecipient);
    console.log("Currency:", selectedCurrency === DeployCurrency.ZORA ? "ZORA" : "ETH");
    console.log("Platform Referrer:", platformReferrer);
    console.log("Initial Purchase Wei:", initialPurchaseWei?.toString() || "0");
    console.log("Initial Purchase ETH:", initialPurchaseWei ? (Number(initialPurchaseWei) / 10**18).toString() : "0");
    console.log("Owners:", owners);
    console.log("Chain ID:", chainId);
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

    // Use the SDK's createCoin function with fee optimization
    // No initial purchase = lower gas costs
    const result = await createCoin(coinParams, optimizedWalletClient, publicClient);

    console.log("=== COIN CREATION SUCCESS ===");
    console.log("Transaction Hash:", result.hash);
    console.log("Coin Address:", result.address);
    console.log("Deployment Details:", result.deployment);
    console.log("Full Result:", result);
    
    // Check if initial purchase was made
    if (initialPurchaseWei && initialPurchaseWei > 0n) {
      console.log("✅ Initial purchase was requested:", (Number(initialPurchaseWei) / 10**18).toString(), "ETH");
      
      // Check transaction value to see if initial purchase ETH was sent
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: result.hash });
        console.log("Transaction Receipt:", receipt);
        console.log("Transaction Status:", receipt.status);
        console.log("Gas Used:", receipt.gasUsed?.toString());
        
        const tx = await publicClient.getTransaction({ hash: result.hash });
        console.log("Transaction Value:", tx.value?.toString(), "wei");
        console.log("Transaction Value ETH:", tx.value ? (Number(tx.value) / 10**18).toString() : "0", "ETH");
        
        if (tx.value && tx.value >= initialPurchaseWei) {
          console.log("✅ Initial purchase ETH was sent with transaction");
        } else {
          console.log("❌ Initial purchase ETH was NOT sent with transaction");
        }
      } catch (error) {
        console.error("Error checking transaction details:", error);
      }
    } else {
      console.log("ℹ️ No initial purchase was requested");
    }

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

// Export the DeployCurrency enum from the SDK for consistency
export { DeployCurrency };
