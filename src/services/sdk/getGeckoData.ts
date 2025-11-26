
/**
 * Fetch pool address for a token from GeckoTerminal API
 * @param tokenAddress The token contract address
 * @returns The address of the top liquidity pool for the token
 */
export async function getGeckoTerminalPool(tokenAddress: string): Promise<string | null> {
  try {
    // GeckoTerminal API endpoint for Base network
    // https://api.geckoterminal.com/api/v2/networks/base/tokens/{token_address}/pools
    const response = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/base/tokens/${tokenAddress}/pools?page=1`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 3600 } // Cache for 1 hour
      }
    );

    if (!response.ok) {
      console.warn(`GeckoTerminal API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // Check if we have pools
    if (data && data.data && data.data.length > 0) {
      // Return the address of the first (top) pool
      // The API usually sorts by liquidity/volume by default
      const topPool = data.data[0];
      return topPool.attributes.address;
    }

    return null;
  } catch (error) {
    console.error('Error fetching GeckoTerminal pool:', error);
    return null;
  }
}
