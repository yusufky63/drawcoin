import { getCoinsBatchSDK } from './sdk/getCoins';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000;

/**
 * Fetches coin data from Zora SDK with robust retry logic for rate limits.
 * Handles 429 errors by waiting and retrying with exponential backoff.
 */
export async function getCoinsBatchWithRetry(addresses: string[], chainId: number = 8453) {
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      return await getCoinsBatchSDK(addresses, chainId);
    } catch (error: any) {
      // If we've exhausted retries, throw the error
      if (retries === MAX_RETRIES - 1) throw error;
      
      // Check if it's a rate limit error (429) or a network error that might be transient
      // Zora SDK might return different error structures, so we check a few common patterns
      const isRateLimit = 
        error?.response?.status === 429 || 
        error?.message?.includes('rate limit') ||
        error?.message?.includes('429') ||
        error?.code === 429;
      
      if (isRateLimit) {
        const delay = INITIAL_BACKOFF * Math.pow(2, retries);
        console.warn(`[ZoraService] Rate limit hit for batch of ${addresses.length} tokens. Retrying in ${delay}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
      } else {
        // For non-rate-limit errors (like 400 Bad Request or 500), we might not want to retry immediately
        // But for stability, let's retry network errors too
        const isNetworkError = error?.message?.includes('network') || error?.code === 'ECONNRESET';
        
        if (isNetworkError) {
           const delay = INITIAL_BACKOFF;
           console.warn(`[ZoraService] Network error. Retrying in ${delay}ms...`);
           await new Promise(resolve => setTimeout(resolve, delay));
           retries++;
        } else {
           throw error; // Don't retry other errors (e.g. validation errors)
        }
      }
    }
  }
  
  throw new Error('Max retries exceeded');
}
