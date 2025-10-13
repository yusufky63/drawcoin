/**
 * @fileoverview Zora SDK functions for market data and explore features
 * @module sdk/getMarket
 */

import {
  getCoinsTopGainers,
  getCoinsTopVolume24h,
  getCoinsMostValuable,
  getCoinsNew,
  getCoinsLastTraded,
  getCoinsLastTradedUnique,
} from "@zoralabs/coins-sdk";

import { setApiKey } from "@zoralabs/coins-sdk";

// Initialize API key for production environments
// Uses environment variable or allows manual override
const initializeApiKey = () => {
  const apiKey = process.env.NEXT_PUBLIC_ZORA_API_KEY;
  if (apiKey) {
    setApiKey(apiKey);
    console.log("✅ Zora API key initialized from environment variables");
  } else {
    console.warn("⚠️ No Zora API key found in environment variables");
  }
};

// Call initialization on module load
initializeApiKey();

/**
 * Fetches top gaining tokens
 * @param {Object} params - Query parameters
 * @param {number} params.count - Number of tokens to fetch
 * @param {string} params.after - Pagination cursor
 * @param {number} params.chainId - Chain ID (default: 8453 for Base)
 * @returns {Promise<Object>} Top gainers data
 */
export const fetchTopGainers = async ({ count = 50, after = null, chainId = 8453 }) => {
  try {
    console.log(`🚀 Fetching top gainers: count=${count}, chainId=${chainId}`);
    const response = await getCoinsTopGainers({ count, after, chainId });
    console.log(`✅ Top gainers fetched successfully: ${response?.data?.exploreList?.edges?.length || 0} tokens`);
    return response;
  } catch (error) {
    console.error("❌ Error fetching top gainers:", error);
    
    // Check if it's a network error
    if (error.message?.includes('404')) {
      throw new Error('Zora API endpoint not found. Please check if the service is available.');
    } else if (error.message?.includes('429')) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    } else if (error.message?.includes('500')) {
      throw new Error('Zora API server error. Please try again later.');
    }
    
    throw error;
  }
};

/**
 * Fetches tokens with highest 24h volume
 * @param {Object} params - Query parameters
 * @param {number} params.count - Number of tokens to fetch
 * @param {string} params.after - Pagination cursor
 * @param {number} params.chainId - Chain ID (default: 8453 for Base)
 * @returns {Promise<Object>} Top volume tokens data
 */
export const fetchTopVolume = async ({ count = 50, after = null, chainId = 8453 }) => {
  try {
    console.log(`📈 Fetching top volume: count=${count}, chainId=${chainId}`);
    const response = await getCoinsTopVolume24h({ count, after, chainId });
    console.log(`✅ Top volume fetched successfully: ${response?.data?.exploreList?.edges?.length || 0} tokens`);
    return response;
  } catch (error) {
    console.error("❌ Error fetching top volume tokens:", error);
    
    // Check if it's a network error
    if (error.message?.includes('404')) {
      throw new Error('Zora API endpoint not found. Please check if the service is available.');
    } else if (error.message?.includes('429')) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    } else if (error.message?.includes('500')) {
      throw new Error('Zora API server error. Please try again later.');
    }
    
    throw error;
  }
};

/**
 * Fetches most valuable tokens
 * @param {Object} params - Query parameters
 * @param {number} params.count - Number of tokens to fetch
 * @param {string} params.after - Pagination cursor
 * @param {number} params.chainId - Chain ID (default: 8453 for Base)
 * @returns {Promise<Object>} Most valuable tokens data
 */
export const fetchMostValuable = async ({ count = 50, after = null, chainId = 8453 }) => {
  try {
    console.log(`💎 Fetching most valuable: count=${count}, chainId=${chainId}`);
    const response = await getCoinsMostValuable({ count, after, chainId });
    console.log(`✅ Most valuable fetched successfully: ${response?.data?.exploreList?.edges?.length || 0} tokens`);
    return response;
  } catch (error) {
    console.error("❌ Error fetching most valuable tokens:", error);
    
    // Check if it's a network error
    if (error.message?.includes('404')) {
      throw new Error('Zora API endpoint not found. Please check if the service is available.');
    } else if (error.message?.includes('429')) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    } else if (error.message?.includes('500')) {
      throw new Error('Zora API server error. Please try again later.');
    }
    
    throw error;
  }
};

/**
 * Fetches newly created tokens
 * @param {Object} params - Query parameters
 * @param {number} params.count - Number of tokens to fetch
 * @param {string} params.after - Pagination cursor
 * @param {number} params.chainId - Chain ID (default: 8453 for Base)
 * @returns {Promise<Object>} New tokens data
 */
export const fetchNewCoins = async ({ count = 50, after = null, chainId = 8453 }) => {
  try {
    console.log(`✨ Fetching new coins: count=${count}, chainId=${chainId}`);
    const response = await getCoinsNew({ count, after, chainId });
    console.log(`✅ New coins fetched successfully: ${response?.data?.exploreList?.edges?.length || 0} tokens`);
    return response;
  } catch (error) {
    console.error("❌ Error fetching new tokens:", error);
    
    // Check if it's a network error
    if (error.message?.includes('404')) {
      throw new Error('Zora API endpoint not found. Please check if the service is available.');
    } else if (error.message?.includes('429')) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    } else if (error.message?.includes('500')) {
      throw new Error('Zora API server error. Please try again later.');
    }
    
    throw error;
  }
};

/**
 * Fetches recently traded tokens
 * @param {Object} params - Query parameters
 * @param {number} params.count - Number of tokens to fetch
 * @param {string} params.after - Pagination cursor
 * @param {number} params.chainId - Chain ID (default: 8453 for Base)
 * @returns {Promise<Object>} Recently traded tokens data
 */
export const fetchLastTraded = async ({ count = 50, after = null, chainId = 8453 }) => {
  try {
    console.log(`🔥 Fetching recently traded: count=${count}, chainId=${chainId}`);
    const response = await getCoinsLastTraded({ count, after, chainId });
    console.log(`✅ Recently traded fetched successfully: ${response?.data?.exploreList?.edges?.length || 0} tokens`);
    return response;
  } catch (error) {
    console.error("❌ Error fetching recently traded tokens:", error);
    
    // Check if it's a network error
    if (error.message?.includes('404')) {
      throw new Error('Zora API endpoint not found. Please check if the service is available.');
    } else if (error.message?.includes('429')) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    } else if (error.message?.includes('500')) {
      throw new Error('Zora API server error. Please try again later.');
    }
    
    throw error;
  }
};

/**
 * Fetches unique recently traded tokens
 * @param {Object} params - Query parameters
 * @param {number} params.count - Number of tokens to fetch
 * @param {string} params.after - Pagination cursor
 * @param {number} params.chainId - Chain ID (default: 8453 for Base)
 * @returns {Promise<Object>} Unique recently traded tokens data
 */
export const fetchLastTradedUnique = async ({ count = 50, after = null, chainId = 8453 }) => {
  try {
    console.log(`🎯 Fetching unique recently traded: count=${count}, chainId=${chainId}`);
    const response = await getCoinsLastTradedUnique({ count, after, chainId });
    console.log(`✅ Unique recently traded fetched successfully: ${response?.data?.exploreList?.edges?.length || 0} tokens`);
    return response;
  } catch (error) {
    console.error("❌ Error fetching unique recently traded tokens:", error);
    
    // Check if it's a network error
    if (error.message?.includes('404')) {
      throw new Error('Zora API endpoint not found. Please check if the service is available.');
    } else if (error.message?.includes('429')) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    } else if (error.message?.includes('500')) {
      throw new Error('Zora API server error. Please try again later.');
    }
    
    throw error;
  }
};

/**
 * Generic fetch with retry mechanism for market data
 * @param {Function} fn - SDK function to call
 * @param {Object} args - Function arguments
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delay - Delay between retries in ms
 * @returns {Promise<Object>} Response data
 */
export async function fetchWithRetry(fn, args, maxRetries = 3, delay = 2000) {
  let lastError;
  
  console.log(`🔄 Starting fetchWithRetry: ${fn.name}, maxRetries=${maxRetries}`);
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`📡 Attempt ${attempt + 1}/${maxRetries} for ${fn.name}`);
      const response = await fn(args);
      console.log(`✅ ${fn.name} succeeded on attempt ${attempt + 1}`);
      return response;
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Attempt ${attempt + 1}/${maxRetries} failed for ${fn.name}:`, error.message);
      
      // Retry on rate limit (429), server errors (500), or network errors
      const is429 = error?.response?.status === 429 || 
                    error?.status === 429 || 
                    error?.message?.includes('429') ||
                    error?.message?.includes('rate limit');
                    
      const is500 = error?.response?.status >= 500 || 
                    error?.status >= 500 || 
                    error?.message?.includes('500') ||
                    error?.message?.includes('server error');
                    
      const isNetwork = error?.message?.includes('Network') || 
                       error?.message?.includes('network') ||
                       error?.message?.includes('fetch');
      
      if ((is429 || is500 || isNetwork) && attempt < maxRetries - 1) {
        const waitTime = is429 ? delay * 2 : delay; // Wait longer for rate limits
        console.log(`⏳ Retrying in ${waitTime}ms (${attempt + 1}/${maxRetries})...`);
        await new Promise((res) => setTimeout(res, waitTime));
          // Increase delay for next attempt (exponential backoff)
        delay = Math.min(delay * 1.5, 10000); // Max 10 seconds
      } else {
        // Don't retry for client errors (400-499 except 429)
        console.error(`❌ ${fn.name} failed permanently:`, error.message);
        break;
      }
    }
  }
  
  console.error(`💥 ${fn.name} failed after ${maxRetries} attempts`);
  throw lastError;
} 