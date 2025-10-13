/**
 * @fileoverview Service functions for Zora SDK trade operations
 * @module tradeCoin
 */

import { tradeCoin, createTradeCall, setApiKey, getCoin } from "@zoralabs/coins-sdk";
import { parseEther, parseUnits } from "viem";

// Initialize API key for production environments
// Uses environment variable or allows manual override
const initializeApiKey = () => {
  const apiKey = process.env.NEXT_PUBLIC_ZORA_API_KEY;
  if (apiKey) {
    setApiKey(apiKey);
    console.log("Zora API key initialized from environment variables:", apiKey.substring(0, 8) + "...");
  } else {
    console.warn("Zora API key not found! Trading may fail without API key.");
  }
};

// Call initialization on module load
initializeApiKey();

/**
 * Gets the correct ZORA token address from SDK
 * @returns {Promise<string>} ZORA token address
 */
export async function getZORATokenAddress() {
  try {
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
 * Executes a trade using the simplest Zora SDK approach
 * @param {Object} params - Trade parameters
 * @param {string} params.direction - Trade direction ('buy' or 'sell')
 * @param {string} params.coinAddress - Coin address
 * @param {string} params.amountIn - Amount to trade (ETH for buy, tokens for sell)
 * @param {string} params.recipient - Recipient address
 * @param {string} [params.referrer] - Platform referrer address
 * @param {number} [params.slippage] - Slippage tolerance (default: 0.05 = 5%)
 * @param {Object} params.walletClient - Viem wallet client
 * @param {Object} params.publicClient - Viem public client
 * @param {Object} params.account - Account object
 * @returns {Promise<Object>} Transaction receipt
 */
export async function executeTrade({
  direction,
  coinAddress,
  amountIn,
  recipient,
  referrer = "0xbFA6A45Dd534d39dF47A3F3D2f2b6E88416f9831",
  slippage = 0.05,
  walletClient,
  publicClient,
  account
}) {
  try {
    console.log("=== ZORA TRADE EXECUTION START ===");
    console.log("Direction:", direction);
    console.log("Coin Address:", coinAddress);
    console.log("Amount In:", amountIn);
    console.log("Recipient:", recipient);
    console.log("Account:", account);

    // Validate Base network requirement (Zora SDK only supports Base mainnet)
    const chainId = await walletClient.getChainId();
    console.log("Current chain ID:", chainId);
    
    if (chainId !== 8453) {
      throw new Error("Zora coins trading only supported on Base network (Chain ID: 8453). Please switch to Base network.");
    }

    // Determine sender and recipient addresses
    const senderAddress = (typeof account === 'string' ? account : account?.address) || recipient;
    const recipientAddress = recipient || senderAddress;

    // Prepare trade parameters for new Zora SDK tradeCoin function
    let tradeParameters;
    
    if (direction === 'buy') {
      // Buying coin with ETH
      tradeParameters = {
        sell: { type: "eth" },
        buy: { type: "erc20", address: coinAddress },
        amountIn: parseEther(amountIn.toString()),
        slippage: slippage,
        sender: senderAddress,
        recipient: recipientAddress
      };
    } else {
      // Selling coin for ETH - need to get token decimals
      let tokenDecimals = 18;
      try {
        const erc20DecimalsAbi = [{ constant: true, inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], type: 'function' }];
        tokenDecimals = await publicClient.readContract({ address: coinAddress, abi: erc20DecimalsAbi, functionName: 'decimals' });
      } catch (decErr) {
        console.warn('Failed to fetch token decimals; defaulting to 18', decErr);
      }
      
      tradeParameters = {
        sell: { type: "erc20", address: coinAddress },
        buy: { type: "eth" },
        amountIn: parseUnits(amountIn.toString(), Number(tokenDecimals)),
        slippage: slippage,
        sender: senderAddress,
        recipient: recipientAddress
      };
    }

    console.log("=== TRADE PARAMETERS ===");
    console.log("Sell:", tradeParameters.sell);
    console.log("Buy:", tradeParameters.buy);
    console.log("Amount In (BigInt):", tradeParameters.amountIn.toString());
    console.log("Slippage:", tradeParameters.slippage);
    console.log("Sender:", tradeParameters.sender);

    // Execute the trade using new Zora SDK tradeCoin function
    console.log("=== CALLING ZORA tradeCoin ===");
    
    const result = await tradeCoin({
      tradeParameters,
      walletClient,
      account: walletClient.account || account,
      publicClient,
      validateTransaction: true
    });

    console.log("=== TRADE SUCCESS ===");
    console.log("Result:", result);
    return result;

  } catch (error) {
    console.error("=== TRADE ERROR ===");
    console.error("Error object:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    // Specific error handling for common issues
    if (error.message?.includes("Quote failed") || error.message?.includes("500")) {
      throw new Error("This coin is not ready for trading yet. ");
    }
    
    if (error.message?.includes("Internal Server Error")) {
      throw new Error("Zora API is currently unavailable. Please try again in a few minutes.");
    }
    
    // Re-throw with shorter error message
    const shortMessage = error.message?.length > 100 ? 
      error.message.substring(0, 100) + '...' : 
      error.message || 'Unknown error';
    throw new Error(shortMessage);
  }
}

/**
 * Executes a trade between two ERC20 tokens (e.g., USDC to Creator Coin)
 * @param {Object} params - Trade parameters
 * @param {string} params.sellTokenAddress - Address of token to sell
 * @param {string} params.buyTokenAddress - Address of token to buy
 * @param {bigint} params.amountIn - Amount to sell (in token's smallest unit)
 * @param {string} params.recipient - Recipient address
 * @param {number} params.slippage - Slippage tolerance (0-1)
 * @param {Object} params.walletClient - Wallet client
 * @param {Object} params.publicClient - Public client
 * @param {Object} params.account - Account object
 * @returns {Promise<Object>} Transaction receipt
 */
export async function executeERC20Trade({
  sellTokenAddress,
  buyTokenAddress,
  amountIn,
  recipient,
  slippage = 0.05,
  walletClient,
  publicClient,
  account
}) {
  try {
    console.log("Starting ERC20 to ERC20 trade:", {
      sellTokenAddress,
      buyTokenAddress,
      amountIn: amountIn.toString(),
      recipient,
      slippage
    });


    // Validate Base network requirement
    const chainId = await walletClient.getChainId();
    if (chainId !== 8453) {
      throw new Error("Zora coins trading only supported on Base network (Chain ID: 8453). Please switch to Base network.");
    }

    const senderAddress = (typeof account === 'string' ? account : account?.address) || recipient;
    const recipientAddress = recipient || senderAddress;

    // Prepare trade parameters for ERC20 to ERC20 trade
    const tradeParameters = {
      sell: { type: "erc20", address: sellTokenAddress },
      buy: { type: "erc20", address: buyTokenAddress },
      amountIn: amountIn,
      slippage: slippage,
      sender: senderAddress,
      recipient: recipientAddress
    };

    console.log("ERC20 Trade parameters:", tradeParameters);

    // Execute the trade using new Zora SDK tradeCoin function
    const result = await tradeCoin({
      tradeParameters,
      walletClient,
      account: walletClient.account || account,
      publicClient,
      validateTransaction: true
    });

    console.log("ERC20 Trade executed successfully:", result);
    return result;

  } catch (error) {
    console.error("ERC20 Trade execution failed:", error);
    
    // Handle specific error cases
    if (error.message?.includes("Quote failed") || error.message?.includes("500")) {
      throw new Error("One of these tokens is not ready for trading yet. Please wait a few minutes and try again.");
    }
    
    if (error.message?.includes("Internal Server Error")) {
      throw new Error("Zora API is currently unavailable. Please try again in a few minutes.");
    }

    if (error.message?.includes("Execution reverted")) {
      throw new Error("Trade execution failed. Please check your balance and try again.");
    }
    
    // Re-throw with shorter error message
    const shortMessage = error.message?.length > 100 ? 
      error.message.substring(0, 100) + '...' : 
      error.message || 'Unknown error';
    throw new Error(shortMessage);
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
 * @returns {Promise<object>} Validation result
 */
export const validateTradeBalance = async (
  userAddress,
  coinAddress,
  tradeType,
  amount,
  publicClient
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
          message: `Insufficient ETH balance. Your balance: ${ethers.formatEther(
            ethBalance
          )} ETH, required: ~${ethers.formatEther(
            amount + gasReserve
          )} ETH (trade + gas)`,
        };
      }
    } else if (tradeType === "sell") {
      // Check token balance for sells
      const tokenBalance = await checkTokenBalance(userAddress, coinAddress, publicClient);
      
      if (tokenBalance < amount) {
        return {
          isValid: false,
          currentBalance: tokenBalance,
          message: `Insufficient token balance. Your balance: ${ethers.formatUnits(
            tokenBalance, 18
          )}, required: ${ethers.formatUnits(amount, 18)}`,
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
