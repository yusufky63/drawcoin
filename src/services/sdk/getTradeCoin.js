/**
 * @fileoverview Service functions for Zora SDK trade operations
 * @module tradeCoin
 */

import { tradeCoin, setApiKey } from "@zoralabs/coins-sdk";
import { parseEther, parseUnits } from "viem";
import { checkAndSwitchNetwork } from '../networkUtils';
import { 
  getZORATokenAddress, 
  validateCoinForTrade, 
  extractTradeFromLogs, 
  checkETHBalance, 
  checkTokenBalance, 
  validateTradeBalance 
} from './tradeUtils';

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
 * Retry mechanism for RPC rate limiting and temporary errors
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Delay between retries in ms
 * @returns {Promise} - Result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRetryableError = 
        error?.message?.includes('rate limited') ||
        error?.message?.includes('Request is being rate limited') ||
        error?.message?.includes('Internal Server Error') ||
        error?.message?.includes('An internal error was received') ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('network') ||
        error?.message?.includes('500') ||
        error?.message?.includes('502') ||
        error?.message?.includes('503') ||
        error?.message?.includes('504') ||
        error?.message?.includes('InternalRpcError') ||
        error?.message?.includes('RPC') ||
        error?.message?.includes('connection') ||
        error?.message?.includes('fetch') ||
        error?.message?.includes('ECONNRESET') ||
        error?.message?.includes('ETIMEDOUT');

      if (isRetryableError && attempt < maxRetries) {
        const backoffDelay = delay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`🔄 Retry attempt ${attempt}/${maxRetries} after ${backoffDelay}ms. Error:`, error.message);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        continue;
      }
      
      // If not retryable or max retries reached, throw the error
      throw error;
    }
  }
}

// Re-export utility functions for backward compatibility
export { 
  getZORATokenAddress, 
  validateCoinForTrade, 
  extractTradeFromLogs, 
  checkETHBalance, 
  checkTokenBalance, 
  validateTradeBalance 
};

/**
 * Universal trade function that supports all trading pairs
 * @param {Object} params - Trade parameters
 * @param {Object} params.sellToken - Token to sell { type: "eth" } | { type: "erc20", address: "0x..." }
 * @param {Object} params.buyToken - Token to buy { type: "eth" } | { type: "erc20", address: "0x..." }
 * @param {bigint} params.amountIn - Amount to sell (in token's smallest unit)
 * @param {string} params.sender - Sender address
 * @param {string} [params.recipient] - Recipient address (defaults to sender)
 * @param {number} [params.slippage] - Slippage tolerance (default: 0.05 = 5%)
 * @param {Object} params.walletClient - Viem wallet client
 * @param {Object} params.publicClient - Viem public client
 * @param {Object} params.account - Account object
 * @param {Function} [params.switchChain] - Network switch function
 * @param {boolean} [params.validateTransaction] - Validate transaction (default: true)
 * @returns {Promise<Object>} Transaction receipt
 */
export async function executeUniversalTrade({
  sellToken,
  buyToken,
  amountIn,
  sender,
  recipient,
  slippage = 0.05,
  walletClient,
  publicClient,
  account,
  switchChain,
  validateTransaction = true,
  creatorAddress = null
}) {
  // Wrap the entire trade execution in retry mechanism
  return await retryWithBackoff(async () => {
    console.log("=== UNIVERSAL TRADE EXECUTION START ===");
    console.log("Sell Token:", sellToken);
    console.log("Buy Token:", buyToken);
    console.log("Amount In:", amountIn.toString());
    console.log("Sender:", sender);
    console.log("Recipient:", recipient || sender);

    // Validate Base network requirement
    const chainId = await walletClient.getChainId();
    console.log("Current chain ID:", chainId);
    
    if (chainId !== 8453) {
      console.log(`Chain mismatch: Connected to chain ${chainId}, but Base (8453) is required. Attempting to switch...`);
      
      if (switchChain) {
        const switchSuccess = await checkAndSwitchNetwork({ chainId, switchChain });
        if (!switchSuccess) {
          throw new Error("Please switch to Base network manually in your wallet.");
        }
        // Wait a moment for the network switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        throw new Error("Zora coins trading only supported on Base network (Chain ID: 8453). Please switch to Base network.");
      }
    }

    // Prepare trade parameters
    const tradeParameters = {
      sell: sellToken,
      buy: buyToken,
      amountIn: amountIn,
      slippage: slippage,
      sender: sender,
      recipient: recipient || sender
    };

    console.log("=== TRADE PARAMETERS ===");
    console.log("Sell:", tradeParameters.sell);
    console.log("Buy:", tradeParameters.buy);
    console.log("Amount In (BigInt):", tradeParameters.amountIn.toString());
    console.log("Slippage:", tradeParameters.slippage);
    console.log("Sender:", tradeParameters.sender);
    console.log("Recipient:", tradeParameters.recipient);

    // Validate balance before trade (including creator restrictions)
    if (sellToken.type === "erc20") {
      const tradeType = "sell";
      const validation = await validateTradeBalance(
        sender,
        sellToken.address,
        tradeType,
        amountIn,
        publicClient,
        creatorAddress
      );
      
      if (!validation.isValid) {
        throw new Error(validation.message);
      }
      
      console.log("Balance validation passed:", validation.message);
    }

    // Execute the trade using Zora SDK tradeCoin function
    console.log("=== CALLING ZORA tradeCoin ===");
    
    const result = await tradeCoin({
      tradeParameters,
      walletClient,
      account: walletClient.account || account,
      publicClient,
      validateTransaction
    });

    console.log("=== TRADE SUCCESS ===");
    console.log("Result:", result);
    return result;
  }, 3, 2000); // 3 retries with 2 second base delay
}


/**
 * Helper function to get token decimals
 * @param {string} tokenAddress - Token address
 * @param {Object} publicClient - Viem public client
 * @returns {Promise<number>} Token decimals
 */
async function getTokenDecimals(tokenAddress, publicClient) {
  try {
    const erc20DecimalsAbi = [{ 
      constant: true, 
      inputs: [], 
      name: 'decimals', 
      outputs: [{ name: '', type: 'uint8' }], 
      type: 'function' 
    }];
    return await publicClient.readContract({ 
      address: tokenAddress, 
      abi: erc20DecimalsAbi, 
      functionName: 'decimals' 
    });
  } catch (error) {
    console.warn('Failed to fetch token decimals; defaulting to 18', error);
    return 18;
  }
}

/**
 * Simplified trade function for backward compatibility
 * @param {Object} params - Trade parameters
 * @param {string} params.direction - Trade direction ('buy' or 'sell')
 * @param {string} params.coinAddress - Coin address
 * @param {string} params.amountIn - Amount to trade (ETH for buy, tokens for sell)
 * @param {string} params.recipient - Recipient address
 * @param {number} [params.slippage] - Slippage tolerance (default: 0.05 = 5%)
 * @param {Object} params.walletClient - Viem wallet client
 * @param {Object} params.publicClient - Viem public client
 * @param {Object} params.account - Account object
 * @param {Function} [params.switchChain] - Network switch function
 * @returns {Promise<Object>} Transaction receipt
 */
export async function executeTrade({
  direction,
  coinAddress,
  amountIn,
  recipient,
  slippage = 0.05,
  walletClient,
  publicClient,
  account,
  switchChain,
  creatorAddress = null
}) {
  // Determine sender address
  const senderAddress = (typeof account === 'string' ? account : account?.address) || recipient;
  
  let sellToken, buyToken, amountInBigInt;
  
  if (direction === 'buy') {
    // Buying coin with ETH
    sellToken = { type: "eth" };
    buyToken = { type: "erc20", address: coinAddress };
    amountInBigInt = parseEther(amountIn.toString());
  } else {
    // Selling coin for ETH
    const tokenDecimals = await getTokenDecimals(coinAddress, publicClient);
    sellToken = { type: "erc20", address: coinAddress };
    buyToken = { type: "eth" };
    amountInBigInt = parseUnits(amountIn.toString(), Number(tokenDecimals));
  }

  return await executeUniversalTrade({
    sellToken,
    buyToken,
    amountIn: amountInBigInt,
    sender: senderAddress,
    recipient: recipient || senderAddress,
    slippage,
    walletClient,
    publicClient,
    account,
    switchChain,
    creatorAddress
  });
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
 * @param {Function} [params.switchChain] - Network switch function
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
  account,
  switchChain,
  creatorAddress = null
}) {
  const senderAddress = (typeof account === 'string' ? account : account?.address) || recipient;
  
  return await executeUniversalTrade({
    sellToken: { type: "erc20", address: sellTokenAddress },
    buyToken: { type: "erc20", address: buyTokenAddress },
    amountIn: amountIn,
    sender: senderAddress,
    recipient: recipient || senderAddress,
    slippage,
    walletClient,
    publicClient,
    account,
    switchChain,
    creatorAddress
  });
}

/**
 * Helper function to create trade parameters for ETH to any token
 * @param {string} tokenAddress - Token address to buy
 * @param {string} ethAmount - ETH amount as string
 * @param {string} sender - Sender address
 * @param {string} [recipient] - Recipient address
 * @param {number} [slippage] - Slippage tolerance
 * @returns {Object} Trade parameters
 */
export function createETHToTokenTrade(tokenAddress, ethAmount, sender, recipient, slippage = 0.05) {
  return {
    sellToken: { type: "eth" },
    buyToken: { type: "erc20", address: tokenAddress },
    amountIn: parseEther(ethAmount),
    sender,
    recipient: recipient || sender,
    slippage
  };
}

/**
 * Helper function to create trade parameters for any token to ETH
 * @param {string} tokenAddress - Token address to sell
 * @param {string} tokenAmount - Token amount as string
 * @param {number} tokenDecimals - Token decimals
 * @param {string} sender - Sender address
 * @param {string} [recipient] - Recipient address
 * @param {number} [slippage] - Slippage tolerance
 * @returns {Object} Trade parameters
 */
export function createTokenToETHTrade(tokenAddress, tokenAmount, tokenDecimals, sender, recipient, slippage = 0.05) {
  return {
    sellToken: { type: "erc20", address: tokenAddress },
    buyToken: { type: "eth" },
    amountIn: parseUnits(tokenAmount, tokenDecimals),
    sender,
    recipient: recipient || sender,
    slippage
  };
}

/**
 * Helper function to create trade parameters for token to token
 * @param {string} sellTokenAddress - Token address to sell
 * @param {string} buyTokenAddress - Token address to buy
 * @param {bigint} amountIn - Amount to sell (in smallest unit)
 * @param {string} sender - Sender address
 * @param {string} [recipient] - Recipient address
 * @param {number} [slippage] - Slippage tolerance
 * @returns {Object} Trade parameters
 */
export function createTokenToTokenTrade(sellTokenAddress, buyTokenAddress, amountIn, sender, recipient, slippage = 0.05) {
  return {
    sellToken: { type: "erc20", address: sellTokenAddress },
    buyToken: { type: "erc20", address: buyTokenAddress },
    amountIn,
    sender,
    recipient: recipient || sender,
    slippage
  };
}

/**
 * Execute trade with pre-built parameters
 * @param {Object} tradeParams - Trade parameters from helper functions
 * @param {Object} clients - Wallet and public clients
 * @param {Object} account - Account object
 * @param {Function} [switchChain] - Network switch function
 * @returns {Promise<Object>} Transaction receipt
 */
export async function executeTradeWithParams(tradeParams, clients, account, switchChain, creatorAddress = null) {
  return await executeUniversalTrade({
    ...tradeParams,
    walletClient: clients.walletClient,
    publicClient: clients.publicClient,
    account,
    switchChain,
    creatorAddress
  });
}

