/**
 * @fileoverview Service functions for Zora SDK trade operations
 * @module tradeCoin
 */

import { tradeCoin, setApiKey } from "@zoralabs/coins-sdk";
import { parseEther, parseUnits } from "viem";
import { checkAndSwitchNetwork } from "../networkUtils";
import { getBuilderCodeSuffix } from "../../lib/builderCode";
import {
  getZORATokenAddress,
  validateCoinForTrade,
  extractTradeFromLogs,
  checkETHBalance,
  checkTokenBalance,
  validateTradeBalance,
} from "./tradeUtils";
import { AnalyticsService } from "../analyticsService";

// Initialize API key for production environments
// Uses environment variable or allows manual override
const initializeApiKey = () => {
  const apiKey = process.env.ZORA_API_KEY;
  if (apiKey) {
    setApiKey(apiKey);
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
        error?.message?.includes("rate limited") ||
        error?.message?.includes("Request is being rate limited") ||
        error?.message?.includes("Internal Server Error") ||
        error?.message?.includes("An internal error was received") ||
        error?.message?.includes("timeout") ||
        error?.message?.includes("network") ||
        error?.message?.includes("500") ||
        error?.message?.includes("502") ||
        error?.message?.includes("503") ||
        error?.message?.includes("504") ||
        error?.message?.includes("InternalRpcError") ||
        error?.message?.includes("RPC") ||
        error?.message?.includes("connection") ||
        error?.message?.includes("fetch") ||
        error?.message?.includes("ECONNRESET") ||
        error?.message?.includes("ETIMEDOUT");

      if (isRetryableError && attempt < maxRetries) {
        const backoffDelay = delay * Math.pow(2, attempt - 1); // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
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
  validateTradeBalance,
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
  creatorAddress = null,
}) {
  // Wrap the entire trade execution in retry mechanism
  return await retryWithBackoff(
    async () => {
      // Validate Base network requirement
      const chainId = await walletClient.getChainId();

      if (chainId !== 8453) {
        if (switchChain) {
          const switchSuccess = await checkAndSwitchNetwork({
            chainId,
            switchChain,
          });
          if (!switchSuccess) {
            throw new Error(
              "Please switch to Base network manually in your wallet.",
            );
          }
          // Wait a moment for the network switch to complete
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          throw new Error(
            "Zora coins trading only supported on Base network (Chain ID: 8453). Please switch to Base network.",
          );
        }
      }

      // Prepare trade parameters
      const tradeParameters = {
        sell: sellToken,
        buy: buyToken,
        amountIn: amountIn,
        slippage: slippage,
        sender: sender,
        recipient: recipient || sender,
      };

      // Validate balance before trade (including creator restrictions)
      if (sellToken.type === "erc20") {
        const tradeType = "sell";
        const validation = await validateTradeBalance(
          sender,
          sellToken.address,
          tradeType,
          amountIn,
          publicClient,
          creatorAddress,
        );

        if (!validation.isValid) {
          throw new Error(validation.message);
        }
      }

      // Execute the trade using Zora SDK tradeCoin function
      // Append ERC-8021 Builder Code suffix for Base attribution
      const builderSuffix = getBuilderCodeSuffix();
      const walletClientWithSuffix = builderSuffix
        ? new Proxy(walletClient, {
            get(target, prop) {
              if (prop === "sendTransaction") {
                return async (args) => {
                  const data = args.data || "0x";
                  const newData = data + builderSuffix.slice(2);
                  return target.sendTransaction({ ...args, data: newData });
                };
              }
              return target[prop];
            },
          })
        : walletClient;

      const result = await tradeCoin({
        tradeParameters,
        walletClient: walletClientWithSuffix,
        account: walletClient.account || account,
        publicClient,
        validateTransaction,
      });

      // Record analytics for trade
      try {
        // Determine trade direction and amounts
        const isBuy = buyToken.type === "erc20" && sellToken.type === "eth";
        const isSell = sellToken.type === "erc20" && buyToken.type === "eth";

        if (isBuy || isSell) {
          const tokenAddress = isBuy ? buyToken.address : sellToken.address;
          const tradeType = isBuy ? "buy" : "sell";

          // Calculate actual amounts
          let amountEth = 0;
          let amountToken = 0;

          if (isBuy) {
            // For buy: user spent ETH
            amountEth = Number(amountIn) / 1e18;

            // Try to get token amount from result - try multiple sources
            if (result.buyAmount) {
              amountToken = Number(result.buyAmount) / 1e18;
            } else if (result.sellAmount) {
              // Sometimes sellAmount contains the token amount received
              amountToken = Number(result.sellAmount) / 1e18;
            } else if (result.logs && result.logs.length > 0) {
              // Extract token amount from Transfer logs

              try {
                // Look for Transfer events to/from the user for the token
                for (const log of result.logs) {
                  // Transfer event signature: Transfer(address,address,uint256)
                  // Topic 0: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
                  if (
                    log.topics &&
                    log.topics[0] ===
                      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
                  ) {
                    // Check if this is a transfer TO the user (topic[2] = recipient)
                    const recipient = log.topics[2];
                    const userAddressPadded =
                      "0x" + sender.slice(2).toLowerCase().padStart(64, "0");

                    if (
                      recipient &&
                      recipient.toLowerCase() ===
                        userAddressPadded.toLowerCase()
                    ) {
                      // This is a transfer TO the user - extract amount from data
                      const transferAmount = BigInt(log.data);
                      amountToken = Number(transferAmount) / 1e18;
                      break;
                    }
                  }
                }

                if (amountToken === 0) {
                }
              } catch (logError) {
                console.warn(`[Analytics] Buy - Error parsing logs:`, logError);
                amountToken = 0;
              }
            } else {
              amountToken = 0;
            }
          } else {
            // For sell: user sold tokens
            amountToken = Number(amountIn) / 1e18;

            // ETH received from sell - try multiple sources
            if (result.sellAmount) {
              amountEth = Number(result.sellAmount) / 1e18;
            } else if (result.buyAmount) {
              // Sometimes buyAmount contains the ETH received
              amountEth = Number(result.buyAmount) / 1e18;
            } else {
              // Try to extract from transaction logs

              // Look for Transfer events in logs to find ETH amount
              if (result.logs && result.logs.length > 0) {
                // This is a fallback - we might need to parse specific log events
                amountEth = 0;
              } else {
                amountEth = 0;
              }
            }
          }

          // Fetch current ETH price from multi-source API
          let ethPriceUSD = 3000; // Fallback
          try {
            const priceResponse = await fetch("/api/crypto-price?symbol=ETH");
            const priceData = await priceResponse.json();

            if (priceData.success && priceData.price) {
              ethPriceUSD = priceData.price;
            } else if (priceData.fallbackPrice) {
              ethPriceUSD = priceData.fallbackPrice;
              console.warn("[Analytics] Using fallback price:", ethPriceUSD);
            }
          } catch (priceError) {
            console.warn(
              "[Analytics] Could not fetch ETH price, using fallback:",
              priceError,
            );
          }

          let amountUsd = amountEth * ethPriceUSD;

          // If we couldn't get ETH amount from sell, try to calculate from token price
          if (isSell && amountEth === 0 && amountToken > 0) {
            // Try to get token price from Zora data or estimate
            try {
              // Fetch current token data to get price
              const { getCoinDetails } = await import("./getCoins");
              const tokenData = await getCoinDetails(tokenAddress);

              if (tokenData?.tokenPrice?.priceInUsdc) {
                const tokenPriceUsd = parseFloat(
                  tokenData.tokenPrice.priceInUsdc,
                );
                amountUsd = amountToken * tokenPriceUsd;
                amountEth = amountUsd / ethPriceUSD;
              } else {
                console.warn(
                  `[Analytics] Sell - Could not get token price, using 0`,
                );
              }
            } catch (priceError) {
              console.warn(
                `[Analytics] Sell - Error getting token price:`,
                priceError,
              );
            }
          } else {
          }

          // Ensure we have a real transaction hash - try multiple sources
          const txHash =
            result.transactionHash ||
            result.hash ||
            result.receipt?.transactionHash;
          if (!txHash) {
            console.warn(
              "[Analytics] No transaction hash found, skipping analytics",
            );
            console.warn("[Analytics] Result keys:", Object.keys(result));
            return result;
          }

          const transactionData = {
            tx_hash: txHash,
            user_address: sender,
            token_address: tokenAddress,
            type: tradeType,
            amount_token: amountToken,
            amount_eth: amountEth,
            amount_usd: amountUsd,
            price_eth: ethPriceUSD,
            price_usd: ethPriceUSD,
          };

          const recordResult =
            await AnalyticsService.recordTransaction(transactionData);
        } else {
          console.warn(
            "[Analytics] Trade type not recognized, skipping analytics",
          );
        }
      } catch (analyticsError) {
        console.error("❌ Analytics error (non-blocking):", analyticsError);
      }

      return result;
    },
    3,
    2000,
  ); // 3 retries with 2 second base delay
}

/**
 * Helper function to get token decimals
 * @param {string} tokenAddress - Token address
 * @param {Object} publicClient - Viem public client
 * @returns {Promise<number>} Token decimals
 */
async function getTokenDecimals(tokenAddress, publicClient) {
  try {
    const erc20DecimalsAbi = [
      {
        constant: true,
        inputs: [],
        name: "decimals",
        outputs: [{ name: "", type: "uint8" }],
        type: "function",
      },
    ];
    return await publicClient.readContract({
      address: tokenAddress,
      abi: erc20DecimalsAbi,
      functionName: "decimals",
    });
  } catch (error) {
    console.warn("Failed to fetch token decimals; defaulting to 18", error);
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
  creatorAddress = null,
}) {
  // Determine sender address
  const senderAddress =
    (typeof account === "string" ? account : account?.address) || recipient;

  let sellToken, buyToken, amountInBigInt;

  if (direction === "buy") {
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
    creatorAddress,
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
  creatorAddress = null,
}) {
  const senderAddress =
    (typeof account === "string" ? account : account?.address) || recipient;

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
    creatorAddress,
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
export function createETHToTokenTrade(
  tokenAddress,
  ethAmount,
  sender,
  recipient,
  slippage = 0.05,
) {
  return {
    sellToken: { type: "eth" },
    buyToken: { type: "erc20", address: tokenAddress },
    amountIn: parseEther(ethAmount),
    sender,
    recipient: recipient || sender,
    slippage,
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
export function createTokenToETHTrade(
  tokenAddress,
  tokenAmount,
  tokenDecimals,
  sender,
  recipient,
  slippage = 0.05,
) {
  return {
    sellToken: { type: "erc20", address: tokenAddress },
    buyToken: { type: "eth" },
    amountIn: parseUnits(tokenAmount, tokenDecimals),
    sender,
    recipient: recipient || sender,
    slippage,
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
export function createTokenToTokenTrade(
  sellTokenAddress,
  buyTokenAddress,
  amountIn,
  sender,
  recipient,
  slippage = 0.05,
) {
  return {
    sellToken: { type: "erc20", address: sellTokenAddress },
    buyToken: { type: "erc20", address: buyTokenAddress },
    amountIn,
    sender,
    recipient: recipient || sender,
    slippage,
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
export async function executeTradeWithParams(
  tradeParams,
  clients,
  account,
  switchChain,
  creatorAddress = null,
) {
  return await executeUniversalTrade({
    ...tradeParams,
    walletClient: clients.walletClient,
    publicClient: clients.publicClient,
    account,
    switchChain,
    creatorAddress,
  });
}
