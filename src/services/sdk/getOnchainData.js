import { createPublicClient, http, formatEther } from "viem";
import { base } from "viem/chains";
import { getCoin } from "@zoralabs/coins-sdk";
import { setApiKey } from "@zoralabs/coins-sdk";

// Initialize API key for production environments
// Uses environment variable or allows manual override
const initializeApiKey = () => {
  const apiKey = process.env.NEXT_PUBLIC_ZORA_API_KEY;
  if (apiKey) {
    setApiKey(apiKey);
    console.log("Zora API key initialized from environment variables");
  } else {
    console.warn("Zora API key not found in environment variables");
  }
};

// Call initialization on module load
initializeApiKey();

// Use RPC URL from environment variables or default to Base RPC
const RPC_URL =  "https://base-mainnet.g.alchemy.com/v2/W0EIbyevIb8MhQyUPQecm";

// Create Viem public client
export const getPublicClient = () => {
  return createPublicClient({
    chain: base,
    transport: http(RPC_URL),
  });
};

/**
 * Safely format BigInt values to ETH strings
 * @param {any} value - Value to format
 * @returns {string} Formatted ETH value
 */
const safeFormatEther = (value) => {
  if (value === undefined || value === null) return "0";

  // Handle BigInt values directly (as per SDK documentation)
  try {
    if (typeof value === "bigint") {
      return formatEther(value);
    }

    // Handle string representation of BigInt
    if (typeof value === "string" && value !== "0") {
      return formatEther(BigInt(value));
    }

    return "0";
  } catch (error) {
    console.warn("formatEther error:", error, "value:", value);
    return "0";
  }
};

/**
 * Format onchain detail values for safe serialization
 * @param {any} detail - Detail value to format (BigInt according to SDK docs)
 * @returns {object} Formatted detail object
 */
const formatOnchainDetail = (detail) => {
  if (!detail) return { raw: "0", formatted: "0" };

  // According to SDK docs, values are BigInt
  return {
    raw: detail.toString(),
    formatted: safeFormatEther(detail),
  };
};

/**
 * Fetch token details from blockchain
 * @param {string} tokenAddress - Token contract address
 * @param {string} userAddress - Optional user address for balance info
 * @returns {Promise<object>} Token details from blockchain
 */
export const getOnchainTokenDetails = async (
  tokenAddress,
  userAddress = null
) => {
  if (!tokenAddress) {
    console.warn("Token address is required for onchain data");
    return null;
  }

  try {
    const publicClient = getPublicClient();
    
    console.log("Fetching coin details for:", tokenAddress);
    
    // Use Zora SDK's getCoin function as per new documentation
    console.log("=== CALLING ZORA getCoin ===");
    console.log("Parameters:", { address: tokenAddress });
    
    let details;
    try {
      const coinResponse = await getCoin({ address: tokenAddress });
      
      if (!coinResponse.data?.zora20Token) {
        throw new Error("Coin not found in Zora system");
      }
      
      details = coinResponse.data.zora20Token;
      
      console.log("=== getCoin SUCCESS ===");
      console.log("Raw details from Zora SDK:", details);
    } catch (error) {
      console.error("=== getCoin FAILED ===");
      console.error("Error:", error);
      console.error("This might mean the coin is not recognized by Zora yet or there's an API issue");
      
      // Coin Zora sisteminde henüz tanınmıyor olabilir
      throw new Error(`Coin data unavailable from Zora: ${error.message}. The coin might not be ready for trading yet.`);
    }

    // Format according to new SDK response structure
    const tokenDetails = {
      address: details.address || tokenAddress,
      name: details.name || "Unknown Token",
      symbol: details.symbol || "???",
      decimals: details.decimals || 18,
      totalSupply: formatOnchainDetail(details.totalSupply),
      pool: details.pool,
      poolAddress: details.pool?.address || details.poolAddress,
      owners: details.owners || [],
      ownersCount: details.owners?.length || 0,
      marketCap: formatOnchainDetail(details.marketCap),
      liquidity: formatOnchainDetail(details.liquidity),
      payoutRecipient: details.payoutRecipient,
      // Add user balance if available
      ...(details.balance
        ? {
            userBalance: formatOnchainDetail(details.balance),
          }
        : {}),
      // Additional fields from new SDK
      tokenPrice: details.tokenPrice,
      volume24h: details.volume24h,
      totalVolume: details.totalVolume,
      uniqueHolders: details.uniqueHolders,
      createdAt: details.createdAt,
      // Metadata
      fetchedAt: new Date().toISOString(),
      hasError: false,
    };


    console.log("Formatted onchain token details:", tokenDetails);
    return tokenDetails;
  } catch (error) {
    console.warn("Error fetching onchain data:", error?.message || error);

    const msg = String(error?.message || '').toLowerCase();
    const rateLimited = msg.includes('429') || msg.includes('over rate limit') || msg.includes('too many requests') || msg.includes('rate limit');

    // Return error object instead of throwing - allows graceful degradation
    return {
      address: tokenAddress,
      name: "Error Loading",
      symbol: "???",
      decimals: 18,
      totalSupply: {
        raw: "0",
        formatted: "0",
      },
      pool: null,
      owners: [],
      ownersCount: 0,
      marketCap: {
        raw: "0",
        formatted: "0",
      },
      liquidity: {
        raw: "0",
        formatted: "0",
      },
      payoutRecipient: null,
      fetchedAt: new Date().toISOString(),
      hasError: true,
      error: rateLimited ? 'RATE_LIMIT' : (error?.message || 'Unknown error'),
      rateLimited,
    };
  }
};

/**
 * Get formatted liquidity information
 * @param {object} onchainData - Onchain token data
 * @returns {object} Formatted liquidity info
 */
export const getLiquidityInfo = (onchainData) => {
  if (!onchainData?.liquidity) return null;

  const liquidity = onchainData.liquidity;
  return {
    ethAmount: liquidity.formatted || "0",
    raw: liquidity.raw || "0",
    hasLiquidity: parseFloat(liquidity.formatted || "0") > 0,
  };
};

/**
 * Get formatted market cap information
 * @param {object} onchainData - Onchain token data
 * @returns {object} Formatted market cap info
 */
export const getMarketCapInfo = (onchainData) => {
  if (!onchainData?.marketCap) return null;

  const marketCap = onchainData.marketCap;
  return {
    ethAmount: marketCap.formatted || "0",
    raw: marketCap.raw || "0",
    hasValue: parseFloat(marketCap.formatted || "0") > 0,
  };
};

/**
 * Calculate price per token from market cap and supply
 * @param {object} onchainData - Onchain token data
 * @returns {object} Price information
 */
export const getTokenPrice = (onchainData) => {
  if (!onchainData?.marketCap || !onchainData?.totalSupply) {
    return {
      ethPrice: "0",
      hasPrice: false,
    };
  }

  try {
    const marketCapEth = parseFloat(onchainData.marketCap.formatted || "0");
    const totalSupply = parseFloat(onchainData.totalSupply.formatted || "0");

    if (totalSupply === 0) return { ethPrice: "0", hasPrice: false };

    const ethPrice = marketCapEth / totalSupply;

    return {
      ethPrice: ethPrice.toFixed(8),
      hasPrice: ethPrice > 0,
    };
  } catch (error) {
    console.error("Error calculating token price:", error);
    return {
      ethPrice: "0",
      hasPrice: false,
    };
  }
};
