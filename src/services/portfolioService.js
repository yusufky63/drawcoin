/**
 * @fileoverview Portfolio service using Zora API for user holdings and profile data
 * @module services/portfolioService
 */

import { getProfile, getProfileBalances, getProfileCoins, setApiKey } from "@zoralabs/coins-sdk";

// Initialize API key
setApiKey(process.env.NEXT_PUBLIC_ZORA_API_KEY);

/**
 * Fetches user profile information from Zora API
 * @param {string} walletAddress - User's wallet address
 * @returns {Promise<object>} Profile data
 */
export const getUserProfile = async (walletAddress) => {
  try {
    const response = await getProfile({
      identifier: walletAddress,
      chainId: 8453,
    }, {
      headers: {
        "api-key": process.env.NEXT_PUBLIC_ZORA_API_KEY,
      },
    });

    if (response.errors && response.errors.length > 0) {
      throw new Error(`Profile fetch error: ${response.errors[0].message}`);
    }

    return response.data?.profile || null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

/**
 * Fetches coin balances held by a user with pagination and performance optimization
 * @param {string} walletAddress - User's wallet address
 * @param {number} pageSize - Number of balances per page
 * @param {string} cursor - Pagination cursor
 * @returns {Promise<{balances: Array, hasMore: boolean, nextCursor: string}>} Paginated balances
 */
export const getUserBalances = async (walletAddress, pageSize = 20, cursor = undefined) => {
  try {
    const response = await getProfileBalances({
      identifier: walletAddress,
      count: pageSize,
      after: cursor,
      chainId: 8453,
    }, {
      headers: {
        "api-key": process.env.NEXT_PUBLIC_ZORA_API_KEY,
      },
    });

    if (response.errors && response.errors.length > 0) {
      throw new Error(`Balances fetch error: ${response.errors[0].message}`);
    }

    const profile = response.data?.profile;
    let balances = [];
    
    if (profile?.coinBalances?.edges) {
      balances = profile.coinBalances.edges.map(edge => ({
        ...edge.node,
        // Normalize the data structure
        coin: edge.node.coin,
        balance: edge.node.balance,
      }));
    }

    // Check pagination
    const pageInfo = profile?.coinBalances?.pageInfo;
    const hasMore = pageInfo?.hasNextPage || false;
    const nextCursor = pageInfo?.endCursor;

    return {
      balances,
      hasMore,
      nextCursor
    };
  } catch (error) {
    console.error('Error fetching user balances:', error);
    throw error;
  }
};

/**
 * Fetches all coin balances (legacy function for backward compatibility)
 * @param {string} walletAddress - User's wallet address
 * @param {number} pageSize - Number of balances per page
 * @returns {Promise<Array>} Array of coin balances
 */
export const getUserBalancesAll = async (walletAddress, pageSize = 50) => {
  try {
    let allBalances = [];
    let cursor = undefined;
    let hasMore = true;

    while (hasMore) {
      const result = await getUserBalances(walletAddress, pageSize, cursor);
      allBalances = [...allBalances, ...result.balances];
      hasMore = result.hasMore;
      cursor = result.nextCursor;

      // Safety break to prevent infinite loops
      if (!cursor && !hasMore) {
        break;
      }
    }

    return allBalances;
  } catch (error) {
    console.error('Error fetching all user balances:', error);
    throw error;
  }
};

/**
 * Fetches coins created by a user with pagination and performance optimization
 * @param {string} walletAddress - User's wallet address
 * @param {number} pageSize - Number of coins per page
 * @param {string} cursor - Pagination cursor
 * @returns {Promise<{coins: Array, hasMore: boolean, nextCursor: string}>} Paginated created coins
 */
export const getUserCreatedCoins = async (walletAddress, pageSize = 20, cursor = undefined) => {
  try {
    const response = await getProfileCoins({
      identifier: walletAddress,
      count: pageSize,
      after: cursor,
      chainIds: [8453],
    }, {
      headers: {
        "api-key": process.env.NEXT_PUBLIC_ZORA_API_KEY,
      },
    });

    if (response.errors && response.errors.length > 0) {
      throw new Error(`Created coins fetch error: ${response.errors[0].message}`);
    }

    const profile = response.data?.profile;
    let coins = [];
    
    if (profile?.createdCoins?.edges) {
      coins = profile.createdCoins.edges.map(edge => edge.node);
    }

    // Check pagination
    const pageInfo = profile?.createdCoins?.pageInfo;
    const hasMore = pageInfo?.hasNextPage || false;
    const nextCursor = pageInfo?.endCursor;

    return {
      coins,
      hasMore,
      nextCursor
    };
  } catch (error) {
    console.error('Error fetching created coins:', error);
    throw error;
  }
};

/**
 * Fetches all created coins (legacy function for backward compatibility)
 * @param {string} walletAddress - User's wallet address
 * @param {number} pageSize - Number of coins per page
 * @returns {Promise<Array>} Array of created coins
 */
export const getUserCreatedCoinsAll = async (walletAddress, pageSize = 50) => {
  try {
    let allCoins = [];
    let cursor = undefined;
    let hasMore = true;

    while (hasMore) {
      const result = await getUserCreatedCoins(walletAddress, pageSize, cursor);
      allCoins = [...allCoins, ...result.coins];
      hasMore = result.hasMore;
      cursor = result.nextCursor;

      // Safety break to prevent infinite loops
      if (!cursor && !hasMore) {
        break;
      }
    }

    return allCoins;
  } catch (error) {
    console.error('Error fetching all created coins:', error);
    throw error;
  }
};

/**
 * Calculates portfolio statistics
 * @param {Array} balances - Array of coin balances
 * @param {Array} createdCoins - Array of created coins
 * @returns {object} Portfolio statistics
 */
export const calculatePortfolioStats = (balances, createdCoins) => {
  const totalHoldings = balances.length;
  const totalCreated = createdCoins.length;
  
  // Calculate total USD value (if available)
  const totalValueUsd = balances.reduce((sum, balance) => {
    // Try different price fields
    const valueUsd = parseFloat(balance.valueUsd || balance.tokenPrice?.priceInUsdc || balance.current_price || '0');
    return sum + valueUsd;
  }, 0);

  // Calculate total holders across created coins
  const totalHolders = createdCoins.reduce((sum, coin) => {
    return sum + (coin.uniqueHolders || 0);
  }, 0);

  // Calculate total volume across created coins
  const totalVolume = createdCoins.reduce((sum, coin) => {
    return sum + parseFloat(coin.volume24h || '0');
  }, 0);

  // Calculate total market cap across created coins
  const totalMarketCap = createdCoins.reduce((sum, coin) => {
    return sum + parseFloat(coin.marketCap || '0');
  }, 0);

  return {
    totalHoldings,
    totalCreated,
    totalValueUsd,
    totalHolders,
    totalVolume,
    totalMarketCap,
  };
};

/**
 * Transforms Zora API coin data to our internal Coin format with performance optimization
 * @param {object} zoraCoin - Coin data from Zora API
 * @param {boolean} lightweight - If true, only include essential fields
 * @returns {object} Transformed coin data
 */
export const transformZoraCoinToCoin = (zoraCoin, lightweight = false) => {
  const baseCoin = {
    id: zoraCoin.id || zoraCoin.address,
    name: zoraCoin.name || '',
    symbol: zoraCoin.symbol || '',
    description: zoraCoin.description || '',
    contract_address: zoraCoin.address || '',
    image_url: zoraCoin.mediaContent?.previewImage?.medium || 
               zoraCoin.mediaContent?.previewImage?.small || '',
    category: undefined,
    creator_address: zoraCoin.creatorAddress || '',
    creator_name: zoraCoin.creatorProfile?.handle || '',
    tx_hash: '',
    chain_id: zoraCoin.chainId || 8453,
    currency: 'ZORA',
    total_supply: zoraCoin.totalSupply,
    current_price: zoraCoin.tokenPrice?.priceInPoolToken,
    volume_24h: zoraCoin.volume24h || zoraCoin.totalVolume || '0',
    holders: zoraCoin.uniqueHolders || 0,
    created_at: zoraCoin.createdAt || new Date().toISOString(),
    updated_at: zoraCoin.createdAt || new Date().toISOString(),
  };

  if (lightweight) {
    return baseCoin;
  }

  return {
    ...baseCoin,
    // Pool information for charts
    poolAddress: zoraCoin.poolAddress || zoraCoin.pool?.address,
    pool: zoraCoin.pool,
    // Additional Zora-specific data
    marketCap: parseFloat(zoraCoin.marketCap || '0'),
    change24hPct: parseFloat(zoraCoin.marketCapDelta24h || '0'),
    // Keep original Zora data for reference
    ...zoraCoin
  };
};

/**
 * Optimized function to get only essential coin data for list views
 * @param {object} zoraCoin - Coin data from Zora API
 * @returns {object} Lightweight coin data
 */
export const getLightweightCoinData = (zoraCoin) => {
  return {
    id: zoraCoin.id || zoraCoin.address,
    name: zoraCoin.name || '',
    symbol: zoraCoin.symbol || '',
    contract_address: zoraCoin.address || '',
    image_url: zoraCoin.mediaContent?.previewImage?.small || '',
    creator_address: zoraCoin.creatorAddress || '',
    current_price: zoraCoin.tokenPrice?.priceInPoolToken,
    holders: zoraCoin.uniqueHolders || 0,
    created_at: zoraCoin.createdAt || new Date().toISOString(),
  };
};
