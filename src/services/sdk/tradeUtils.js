/**
 * @fileoverview Utility functions for Zora SDK trade operations
 * @module tradeUtils
 */

import { parseEther, parseUnits, formatEther, formatUnits } from "viem";
import { checkAndSwitchNetwork } from '../networkUtils';

/**
 * Gets the correct ZORA token address from SDK
 * @returns {Promise<string>} ZORA token address
 */
export async function getZORATokenAddress() {
  try {
    // Import getCoin dynamically to avoid circular dependencies
    const { getCoin } = await import("@zoralabs/coins-sdk");
    
    // Try to get ZORA token info from SDK
    const zoraCoin = await getCoin({ address: "0x1111111111166b7fe7bd91427724b487980afc69" });
    if (zoraCoin && zoraCoin.address) {
      console.log("ZORA token address from SDK:", zoraCoin.address);
      return zoraCoin.address;
    }
  } catch (error) {
    console.warn("Failed to get ZORA token address from SDK, using fallback:", error);
  }
  
  // Fallback to known ZORA address on Base
  return "0x1111111111166b7fe7bd91427724b487980afc69";
}

/**
 * Validates if a coin is tradeable on Zora
 * @param {string} coinAddress - Coin address to validate
 * @returns {Promise<boolean>} Whether the coin is tradeable
 */
export async function validateCoinForTrade(coinAddress) {
  try {
    // Import getCoin to check if coin exists and has necessary data
    const { getCoin } = await import("@zoralabs/coins-sdk");
    
    // getCoin expects an object with address property, not just the address string
    const coinData = await getCoin({ address: coinAddress });
    
    // Check if coin has necessary trading data
    if (!coinData || !coinData.address) {
      console.warn("Coin not found or invalid:", coinAddress);
      return false;
    }
    
    // Additional validation for Zora coins
    // Check if it's a proper Zora coin with the expected structure
    if (coinData.contractType !== 'ERC20z' && !coinData.symbol) {
      console.warn("Coin may not be a valid Zora coin:", coinAddress);
      return false;
    }
    
    console.log("Coin validation successful:", {
      name: coinData.name || "Unknown",
      symbol: coinData.symbol || "Unknown",
      address: coinData.address
    });
    return true;
  } catch (error) {
    console.error("Coin validation failed:", error.message);
    // For API validation errors, skip validation and allow trade to proceed
    // The trade will fail with better error messages if the coin is truly invalid
    if (error.message?.includes("400") || error.message?.includes("invalid data") || 
        error.message?.includes("required property") || error.message?.includes("fetch") || 
        error.message?.includes("network")) {
      console.warn("API validation failed, allowing trade to proceed - trade will handle validation");
      return true;
    }
    return false;
  }
}

/**
 * Extracts trade event from transaction logs
 * @param {object} receipt - Transaction receipt
 * @param {string} direction - Trade direction
 * @returns {object|null} Trade event details
 */
export const extractTradeFromLogs = (receipt, direction) => {
  try {
    // Use getCoinCreateFromLogs as a fallback - the new SDK may not have trade log extraction
    // We'll extract the trade info manually from receipt logs
    if (receipt && receipt.logs) {
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        logs: receipt.logs
      };
    }
    return null;
  } catch (error) {
    console.error("Trade event extraction error:", error);
    return null;
  }
};

/**
 * Checks ETH balance
 * @param {string} userAddress - User address
 * @param {object} publicClient - Viem public client
 * @returns {Promise<bigint>} ETH balance (wei)
 */
export const checkETHBalance = async (userAddress, publicClient) => {
  try {
    if (!userAddress || !userAddress.startsWith("0x")) {
      throw new Error("Valid user address is required");
    }
    
    if (!publicClient) {
      throw new Error("Valid publicClient is required");
    }
    
    // Implement retry mechanism with exponential backoff
    let retries = 0;
    const maxRetries = 5;
    const baseDelay = 1000; // 1 second initial delay
    
    while (retries <= maxRetries) {
      try {
        const balance = await publicClient.getBalance({
          address: userAddress,
        });
        
        return balance;
      } catch (error) {
        // Check if it's a rate limit error
        const isRateLimit = 
          error.message?.includes("rate limit") || 
          error.message?.includes("over rate limit") || 
          error.details?.includes("rate limit") ||
          error.code === 429 ||
          error.status === 429;
        
        // If we've reached max retries or it's not a rate limit error, throw
        if (retries >= maxRetries || !isRateLimit) {
          throw error;
        }
        
        // Calculate exponential backoff delay with jitter
        const delay = baseDelay * Math.pow(2, retries) + Math.random() * 1000;
        console.log(`Rate limit hit. Retrying in ${Math.round(delay/1000)}s... (Attempt ${retries + 1}/${maxRetries})`);
        
        // Wait for the calculated delay
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Increment retry counter
        retries++;
      }
    }
  } catch (error) {
    console.error("ETH balance check error:", error);
    throw error;
  }
};

/**
 * Checks token balance
 * @param {string} userAddress - User address
 * @param {string} tokenAddress - Token address
 * @param {object} publicClient - Viem public client
 * @returns {Promise<bigint>} Token balance
 */
export const checkTokenBalance = async (
  userAddress,
  tokenAddress,
  publicClient
) => {
  try {
    if (
      !userAddress ||
      !userAddress.startsWith("0x") ||
      !tokenAddress ||
      !tokenAddress.startsWith("0x")
    ) {
      throw new Error("Valid addresses are required");
    }
    
    if (!publicClient) {
      throw new Error("Valid publicClient is required");
    }
    
    const erc20ABI = [
      {
        constant: true,
        inputs: [{ name: "owner", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "balance", type: "uint256" }],
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "decimals",
        outputs: [{ name: "", type: "uint8" }],
        type: "function",
      },
    ];
    
    // Implement retry mechanism with exponential backoff
    let retries = 0;
    const maxRetries = 5;
    const baseDelay = 1000; // 1 second initial delay
    
    while (retries <= maxRetries) {
      try {
        const balance = await publicClient.readContract({
          address: tokenAddress,
          abi: erc20ABI,
          functionName: "balanceOf",
          args: [userAddress],
        });
        
        return balance;
      } catch (error) {
        // Check if it's a rate limit error
        const isRateLimit = 
          error.message?.includes("rate limit") || 
          error.message?.includes("over rate limit") || 
          error.details?.includes("rate limit") ||
          error.code === 429 ||
          error.status === 429;
        
        // If we've reached max retries or it's not a rate limit error, throw
        if (retries >= maxRetries || !isRateLimit) {
          throw error;
        }
        
        // Calculate exponential backoff delay with jitter
        const delay = baseDelay * Math.pow(2, retries) + Math.random() * 1000;
        console.log(`Rate limit hit. Retrying in ${Math.round(delay/1000)}s... (Attempt ${retries + 1}/${maxRetries})`);
        
        // Wait for the calculated delay
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Increment retry counter
        retries++;
      }
    }
  } catch (error) {
    console.error("Token balance check error:", error);
    throw error;
  }
};

/**
 * Validates balance sufficiency for trade
 * @param {string} userAddress - User address
 * @param {string} coinAddress - Coin address
 * @param {string} tradeType - Trade type ('buy' or 'sell')
 * @param {bigint} amount - Trade amount
 * @param {object} publicClient - Viem public client
 * @param {string} creatorAddress - Optional creator address for creator validation
 * @returns {Promise<object>} Validation result
 */
export const validateTradeBalance = async (
  userAddress,
  coinAddress,
  tradeType,
  amount,
  publicClient,
  creatorAddress = null
) => {
  try {
    if (!userAddress || !userAddress.startsWith("0x")) {
      return {
        isValid: false,
        currentBalance: 0n,
        message: "Valid user address is required",
      };
    }
    
    if (!amount || amount <= 0n) {
      return {
        isValid: false,
        currentBalance: 0n,
        message: "Valid trade amount is required",
      };
    }

    if (tradeType === "buy") {
      const ethBalance = await checkETHBalance(userAddress, publicClient);
      const gasReserve = 5n * 10n ** 13n; // 0.00005 ETH (reduced gas reserve)
      const availableBalance =
        ethBalance > gasReserve ? ethBalance - gasReserve : 0n;
      
      if (availableBalance < amount) {
        return {
          isValid: false,
          currentBalance: ethBalance,
          message: `Insufficient ETH balance. Your balance: ${formatEther(
            ethBalance
          )} ETH, required: ~${formatEther(
            amount + gasReserve
          )} ETH (trade + gas)`,
        };
      }
    } else if (tradeType === "sell") {
      // Check token balance for sells
      const tokenBalance = await checkTokenBalance(userAddress, coinAddress, publicClient);
      
      // Check if user is the creator and apply 10M token restriction
      let availableBalance = tokenBalance;
      let isCreator = false;
      
      if (creatorAddress && userAddress.toLowerCase() === creatorAddress.toLowerCase()) {
        isCreator = true;
        const initialSupply = 10n * 10n ** 6n * 10n ** 18n; // 10M tokens in wei
        availableBalance = tokenBalance > initialSupply ? tokenBalance - initialSupply : 0n;
        
        console.log("Creator detected - 10M initial supply locked");
        console.log("Total balance:", formatUnits(tokenBalance, 18));
        console.log("Available balance:", formatUnits(availableBalance, 18));
      }
      
      if (availableBalance < amount) {
        const balanceMessage = isCreator 
          ? `Insufficient sellable balance. As creator, you cannot sell the initial 10M tokens. Available: ${formatUnits(availableBalance, 18)}, required: ${formatUnits(amount, 18)}`
          : `Insufficient token balance. Your balance: ${formatUnits(tokenBalance, 18)}, required: ${formatUnits(amount, 18)}`;
          
        return {
          isValid: false,
          currentBalance: availableBalance,
          message: balanceMessage,
        };
      }
      
      // Also check if user has enough ETH for gas
      const ethBalance = await checkETHBalance(userAddress, publicClient);
      const gasReserve = 5n * 10n ** 13n; // 0.00005 ETH (reduced gas reserve) for gas
      
      if (ethBalance < gasReserve) {
        return {
          isValid: false,
          currentBalance: ethBalance,
          message: `Insufficient ETH for gas fees. You need at least 0.00005 ETH for gas.`,
        };
      }
    }
    
    return {
      isValid: true,
      currentBalance: 0n,
      message: "Sufficient balance for trade",
    };
  } catch (error) {
    console.error("Balance validation error:", error);
    throw error;
  }
};
