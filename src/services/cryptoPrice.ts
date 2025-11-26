/**
 * Fetches cryptocurrency prices from the unified API endpoint
 * @param symbol - The cryptocurrency symbol (ETH or ZORA)
 * @returns Promise with price data
 */
export async function getCryptoPrice(symbol: 'ETH' | 'ZORA' = 'ETH'): Promise<number> {
  try {
    const response = await fetch(`/api/crypto-price?symbol=${symbol}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ${symbol} price`);
    }
    
    const data = await response.json();
    
    // If API succeeded, return the price
    if (data.success && data.price) {
      return data.price;
    }
    
    // If API failed but has fallback price, use it
    if (data.fallbackPrice) {
      console.warn(`[CryptoPrice] Using fallback price for ${symbol}: $${data.fallbackPrice}`);
      return data.fallbackPrice;
    }
    
    throw new Error(data.error || 'Failed to fetch price');
  } catch (error) {
    console.error(`[CryptoPrice] Error fetching ${symbol} price:`, error);
    // Return fallback prices in case of network error
    return symbol === 'ETH' ? 3000 : 0.5;
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use getCryptoPrice('ETH') instead
 */
export const getETHPrice = () => getCryptoPrice('ETH');

/**
 * Legacy function for backward compatibility
 * @deprecated Use getCryptoPrice('ZORA') instead
 */
export const getZORAPrice = () => getCryptoPrice('ZORA');
