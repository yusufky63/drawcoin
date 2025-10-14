/**
 * @fileoverview Examples of how to use the new universal trading functions
 * @module tradeExamples
 */

import { 
  executeUniversalTrade,
  executeTrade,
  createETHToTokenTrade,
  executeTradeWithParams
} from './getTradeCoin.js';

/**
 * Example 1: ETH to Creator Coin (Traditional way)
 */
export async function buyCoinWithETH(coinAddress, ethAmount, walletClient, publicClient, account) {
  return await executeTrade({
    direction: 'buy',
    coinAddress: coinAddress,
    amountIn: ethAmount, // "0.001"
    recipient: account.address,
    walletClient,
    publicClient,
    account
  });
}

/**
 * Example 2: Creator Coin to ETH (Traditional way)
 */
export async function sellCoinForETH(coinAddress, tokenAmount, walletClient, publicClient, account) {
  return await executeTrade({
    direction: 'sell',
    coinAddress: coinAddress,
    amountIn: tokenAmount, // "1000"
    recipient: account.address,
    walletClient,
    publicClient,
    account
  });
}

/**
 * Example 3: ETH to Creator Coin (New universal way)
 */
export async function buyCoinWithETHUniversal(coinAddress, ethAmount, walletClient, publicClient, account) {
  return await executeUniversalTrade({
    sellToken: { type: "eth" },
    buyToken: { type: "erc20", address: coinAddress },
    amountIn: BigInt(parseFloat(ethAmount) * 10**18), // Convert to wei
    sender: account.address,
    walletClient,
    publicClient,
    account
  });
}

/**
 * Example 4: Creator Coin to ETH (New universal way)
 */
export async function sellCoinForETHUniversal(coinAddress, tokenAmount, tokenDecimals, walletClient, publicClient, account) {
  return await executeUniversalTrade({
    sellToken: { type: "erc20", address: coinAddress },
    buyToken: { type: "eth" },
    amountIn: BigInt(parseFloat(tokenAmount) * 10**tokenDecimals), // Convert to smallest unit
    sender: account.address,
    walletClient,
    publicClient,
    account
  });
}

/**
 * Example 5: USDC to Creator Coin
 */
export async function buyCoinWithUSDC(coinAddress, usdcAmount, walletClient, publicClient, account) {
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
  const usdcAmountBigInt = BigInt(Math.floor(parseFloat(usdcAmount) * 10**6)); // USDC has 6 decimals
  
  return await executeUniversalTrade({
    sellToken: { type: "erc20", address: USDC_ADDRESS },
    buyToken: { type: "erc20", address: coinAddress },
    amountIn: usdcAmountBigInt,
    sender: account.address,
    walletClient,
    publicClient,
    account
  });
}

/**
 * Example 6: Creator Coin to USDC
 */
export async function sellCoinForUSDC(coinAddress, tokenAmount, tokenDecimals, walletClient, publicClient, account) {
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
  
  return await executeUniversalTrade({
    sellToken: { type: "erc20", address: coinAddress },
    buyToken: { type: "erc20", address: USDC_ADDRESS },
    amountIn: BigInt(parseFloat(tokenAmount) * 10**tokenDecimals),
    sender: account.address,
    walletClient,
    publicClient,
    account
  });
}

/**
 * Example 7: Creator Coin to Creator Coin
 */
export async function swapCoinToCoin(sellCoinAddress, buyCoinAddress, tokenAmount, tokenDecimals, walletClient, publicClient, account) {
  return await executeUniversalTrade({
    sellToken: { type: "erc20", address: sellCoinAddress },
    buyToken: { type: "erc20", address: buyCoinAddress },
    amountIn: BigInt(parseFloat(tokenAmount) * 10**tokenDecimals),
    sender: account.address,
    walletClient,
    publicClient,
    account
  });
}

/**
 * Example 8: Using helper functions
 */
export async function buyCoinWithHelperFunctions(coinAddress, ethAmount, walletClient, publicClient, account) {
  // Create trade parameters
  const tradeParams = createETHToTokenTrade(
    coinAddress,
    ethAmount,
    account.address,
    account.address,
    0.05 // 5% slippage
  );
  
  // Execute trade
  return await executeTradeWithParams(
    tradeParams,
    { walletClient, publicClient },
    account
  );
}

/**
 * Example 9: Advanced trading with custom slippage
 */
export async function advancedTrade(coinAddress, amount, tradeType, slippage, walletClient, publicClient, account) {
  if (tradeType === 'buy') {
    return await executeUniversalTrade({
      sellToken: { type: "eth" },
      buyToken: { type: "erc20", address: coinAddress },
      amountIn: BigInt(parseFloat(amount) * 10**18),
      sender: account.address,
      slippage: slippage, // Custom slippage
      walletClient,
      publicClient,
      account,
      validateTransaction: true
    });
  } else {
    // For sell, we need token decimals
    const tokenDecimals = 18; // You might want to fetch this dynamically
    return await executeUniversalTrade({
      sellToken: { type: "erc20", address: coinAddress },
      buyToken: { type: "eth" },
      amountIn: BigInt(parseFloat(amount) * 10**tokenDecimals),
      sender: account.address,
      slippage: slippage, // Custom slippage
      walletClient,
      publicClient,
      account,
      validateTransaction: true
    });
  }
}
