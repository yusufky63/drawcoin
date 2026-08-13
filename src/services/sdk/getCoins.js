/**
 * @fileoverview Zora SDK functions for fetching coin data
 * @module sdk/getCoins
 */

import {
  getCoin,
  getCoins,
  getCoinComments,
  setApiKey,
} from "@zoralabs/coins-sdk";

// Initialize API key for production environments
// Uses environment variable or allows manual override
const initializeApiKey = () => {
  const apiKey = process.env.ZORA_API_KEY;
  if (apiKey) {
    setApiKey(apiKey);
  }
};

// Call initialization on module load
initializeApiKey();

const ZORA_BATCH_SIZE = 20;

const getAddressKey = (address) =>
  typeof address === "string" ? address.toLowerCase() : address;

/**
 * The generated Zora client resolves non-2xx responses as
 * `{ error, response }` unless `throwOnError` is enabled. Convert that result
 * into an Error while retaining the HTTP status used by our retry policy.
 */
const unwrapSdkResponse = (response, context) => {
  if (response?.error === undefined) {
    return response;
  }

  const sdkError = response.error;
  const status = response.response?.status;
  const sdkMessage =
    typeof sdkError === "string"
      ? sdkError
      : sdkError && typeof sdkError === "object" && "message" in sdkError
        ? sdkError.message
        : undefined;
  const error = new Error(
    sdkMessage ||
      `${context}${Number.isInteger(status) ? ` (HTTP ${status})` : ""}`
  );

  error.status = status;
  error.response = response.response;
  error.sdkError = sdkError;
  throw error;
};

const isAbortedRequest = (error, signal) =>
  signal?.aborted === true || error?.name === "AbortError";

/**
 * Collapse duplicate addresses without reordering the first occurrence.
 * Batch results are keyed by lowercase address, so duplicate inputs have
 * always represented one output entry.
 */
const uniqueAddressesInOrder = (addresses) => {
  const seen = new Set();
  const unique = [];

  for (const address of addresses) {
    const key = getAddressKey(address);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(address);
  }

  return unique;
};

/**
 * API request retry mechanism
 * @param {Function|string} urlOrFn - API URL or function to call
 * @param {object} options - Fetch options
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} retryDelay - Delay between retries (ms)
 * @returns {Promise<object>} API response
 */
const retryFetch = async (
  urlOrFn,
  options = {},
  maxRetries = 5,
  retryDelay = 1000
) => {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let response;

      if (typeof urlOrFn === "function") {
        response = await urlOrFn();
      } else {
        response = await fetch(urlOrFn, options);

        if (!response.ok) {
          throw new Error(
            `HTTP error! Status: ${response.status} - ${response.statusText}`
          );
        }
      }

      if (response.data === undefined && typeof response.json === "function") {
        const jsonData = await response.json();

        if (jsonData.errors && jsonData.errors.length > 0) {
          throw new Error(`API Error: ${jsonData.errors[0].message}`);
        }

        return jsonData;
      }

      return response;
    } catch (error) {
      console.warn(`Request failed (${attempt}/${maxRetries}):`, error.message);
      lastError = error;

      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  console.error(`${maxRetries} attempts failed:`, lastError);

  const retryError = new Error(
    `Request failed. Please check your internet connection and try again.`
  );
  retryError.originalError = lastError;
  retryError.isRetryError = true;
  throw retryError;
};

/**
 * Fetches coin details
 * @param {string} address - Coin address
 * @returns {Promise<object>} Coin details
 */
export async function fetchCoinDetails(address) {
  const fetchCoinData = async () => {
    const response = unwrapSdkResponse(
      await getCoin({
        address,
        chain: 8453,
      }),
      "Failed to fetch coin details"
    );
    return response.data?.zora20Token;
  };

  try {
    return await retryFetch(fetchCoinData);
  } catch (error) {
    console.error("Failed to fetch coin details:", error);
    throw error;
  }
}

/**
 * Fetches coin comments
 * @param {string} coinAddress - Coin address
 * @param {number} count - Comments per page
 * @param {string} after - Cursor for pagination
 * @returns {Promise<object>} Comments and pagination info
 */
export const fetchCoinComments = async (
  coinAddress,
  count = 20,
  after = null
) => {
  try {
    if (!coinAddress) {
      throw new Error("Valid coin address required to load comments");
    }

    const response = unwrapSdkResponse(
      await getCoinComments({
        address: coinAddress,
        chain: 8453,
        count: count,
        after: after,
      }),
      "Failed to fetch coin comments"
    );

    if (!response?.data?.zora20Token?.zoraComments) {
      throw new Error("Failed to fetch comment data");
    }

    return {
      comments: response.data.zora20Token.zoraComments.edges || [],
      pageInfo: response.data.zora20Token.zoraComments.pageInfo || {},
      totalCount: response.data.zora20Token.zoraComments.count || 0,
    };
  } catch (error) {
    console.error("Error fetching comment data:", error);

    if (
      error.message.includes("Failed to fetch") ||
      error.message.includes("NetworkError") ||
      error.message.includes("NetworkRequest")
    ) {
      error.message =
        "Cannot reach comment server. Please check your internet connection.";
    }

    throw error;
  }
};

/**
 * Extracts trade event from transaction logs
 * Note: This is a placeholder. The actual implementation would require importing 
 * the getTradeFromLogs function from the appropriate SDK module.
 * @param {object} receipt - Transaction receipt
 * @param {string} direction - Trade direction
 * @returns {object|null} Trade event details
 */
export const extractTradeFromLogs = (receipt, direction) => {
  try {
    // Log parameters to avoid unused variable warnings
    console.log(`Extracting ${direction} trade from receipt:`, 
      receipt ? `Receipt ID: ${receipt.transactionHash || 'unknown'}` : 'No receipt provided');
      
    // Placeholder for trade extraction logic
    // This functionality may require additional imports or implementation
    console.warn("Trade extraction not fully implemented");
    return null;
  } catch (error) {
    console.error("Error extracting trade event:", error);
    return null;
  }
};

/**
 * Fetches coin details
 * @param {string} address - Coin address
 * @param {number} chain - Chain ID
 * @returns {Promise<object>} Coin details
 */
export const getCoinDetails = async (address, chain = 8453, options = {}) => {
  const maxRetries = Math.max(1, Math.min(3, options.maxRetries ?? 3));
  const retryDelay = Math.max(250, Math.min(2_000, options.retryDelay ?? 750));
  const fetchCoinData = async () => {
    try {
      const response = unwrapSdkResponse(
        await getCoin({
          address,
          chain,
        }),
        "Failed to fetch coin details"
      );

      if (!response?.data?.zora20Token) {
        throw new Error("Failed to fetch coin details");
      }

     
      return response.data.zora20Token;
    } catch (error) {
      console.error("Error fetching coin details:", error);
      throw error;
    }
  };

  try {
    return await retryFetch(fetchCoinData, {}, maxRetries, retryDelay);
  } catch (error) {
    console.error("Error fetching coin details:", error);
    throw error;
  }
};

/**
 * Fetch multiple coins in batches with limited concurrency
 * @param {string[]} addresses - List of token addresses
 * @param {number} chain - Chain ID (default: 8453)
 * @param {number} concurrency - Max concurrent requests
 * @returns {Promise<Record<string, any>>} Map of address -> zora20Token (or null)
 */
export const getCoinsBatch = async (addresses = [], chain = 8453, concurrency = 8) => {
  const out = {};
  const chunks = [];
  for (let i = 0; i < addresses.length; i += concurrency) {
    chunks.push(addresses.slice(i, i + concurrency));
  }
  for (const chunk of chunks) {
    const results = await Promise.all(chunk.map(async (addr) => {
      try {
        const res = unwrapSdkResponse(
          await getCoin({ address: addr, chain }),
          `Failed to fetch coin ${addr}`
        );
        return { addr, data: res?.data?.zora20Token || null };
      } catch (e) {
        console.warn("Batch getCoin failed for", addr, e?.message || e);
        return { addr, data: null };
      }
    }));
    for (const r of results) {
      out[r.addr?.toLowerCase?.() || r.addr] = r.data;
    }
  }
  return out;
};

/**
 * Fetch multiple coins using Zora SDK's getCoins function (batch of specific addresses)
 * @param {string[]} addresses - List of token addresses
 * @param {number} chain - Chain ID (default: 8453)
 * @param {{fallbackToIndividual?: boolean, signal?: AbortSignal}} options
 * @returns {Promise<Record<string, any>>} Map of address -> zora20Token (or null)
 */
export const getCoinsBatchSDK = async (
  addresses = [],
  chain = 8453,
  options = {}
) => {
  if (addresses.length === 0) {
    return {};
  }

  const uniqueAddresses = uniqueAddressesInOrder(addresses);
  const out = {};

  // Initialize every requested key up front so a partial API response cannot
  // make an address disappear from the result.
  for (const address of uniqueAddresses) {
    out[getAddressKey(address)] = null;
  }

  for (let index = 0; index < uniqueAddresses.length; index += ZORA_BATCH_SIZE) {
    const chunk = uniqueAddresses.slice(index, index + ZORA_BATCH_SIZE);
    const coins = chunk.map((address) => ({
      chainId: chain,
      collectionAddress: address,
    }));

    try {
      const response = unwrapSdkResponse(
        await getCoins(
          { coins },
          options.signal ? { signal: options.signal } : undefined
        ),
        "Failed to fetch a Zora coin batch"
      );

      response.data?.zora20Tokens?.forEach((coin) => {
        if (coin?.address) {
          out[getAddressKey(coin.address)] = coin;
        }
      });
    } catch (error) {
      if (isAbortedRequest(error, options.signal)) {
        throw error;
      }

      console.error("Error fetching Zora coin batch:", error);
      if (options.fallbackToIndividual === false) {
        throw error;
      }

      // Isolate a failed chunk: successful chunks remain available and only
      // the affected addresses fall back to individual queries.
      let successfulFallbacks = 0;
      for (const address of chunk) {
        try {
          const response = unwrapSdkResponse(
            await getCoin(
              { address, chain },
              options.signal ? { signal: options.signal } : undefined
            ),
            `Failed to fetch coin ${address}`
          );
          out[getAddressKey(address)] = response.data?.zora20Token || null;
          successfulFallbacks += 1;
        } catch (fallbackError) {
          if (isAbortedRequest(fallbackError, options.signal)) {
            throw fallbackError;
          }
          console.warn(
            "Fallback getCoin failed for",
            address,
            fallbackError?.message || fallbackError
          );
        }
      }

      // If the fallback transport failed for the whole chunk, surface the
      // original batch error so the outer bounded retry policy can run.
      if (successfulFallbacks === 0) {
        throw error;
      }
    }
  }

  return out;
};

/**
 * Searches for a token by address and validates it
 * @param {string} address - Token address to search
 * @returns {Promise<object>} Token details if found and valid
 */
export const searchTokenByAddress = async (address) => {
  try {
    // Basic address validation
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new Error("Invalid token address format");
    }

    const tokenData = await getCoinDetails(address);
    
    if (!tokenData) {
      throw new Error("Token not found");
    }

    // Validate that this is an active token
    if (!tokenData.name || !tokenData.symbol) {
      throw new Error("Invalid token data");
    }

    return {
      success: true,
      data: tokenData
    };

  } catch (error) {
    console.error("Error searching token:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch token"
    };
  }
};
