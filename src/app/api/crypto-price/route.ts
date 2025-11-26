import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface PriceSource {
  name: string;
  fetchPrice: (symbol: string) => Promise<number>;
}

/**
 * Fetch ETH price from Binance
 */
async function fetchBinancePrice(symbol: string): Promise<number> {
  if (symbol !== 'ETH') throw new Error('Binance only supports ETH');
  const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT', {
    next: { revalidate: 30 } // Cache for 30 seconds
  });
  if (!response.ok) throw new Error('Binance API failed');
  const data = await response.json();
  return parseFloat(data.price);
}

/**
 * Fetch price from CoinGecko
 */
async function fetchCoinGeckoPrice(symbol: string): Promise<number> {
  const coinGeckoId = symbol === 'ETH' ? 'ethereum' : symbol.toLowerCase();
  const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`, {
    next: { revalidate: 30 }
  });
  if (!response.ok) throw new Error('CoinGecko API failed');
  const data = await response.json();
  return data[coinGeckoId].usd;
}

/**
 * Fetch ETH price from Coinbase
 */
async function fetchCoinbasePrice(symbol: string): Promise<number> {
  if (symbol !== 'ETH') throw new Error('Coinbase only supports ETH');
  const response = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot', {
    next: { revalidate: 30 }
  });
  if (!response.ok) throw new Error('Coinbase API failed');
  const data = await response.json();
  return parseFloat(data.data.amount);
}

/**
 * Fetch ETH price from Kraken
 */
async function fetchKrakenPrice(symbol: string): Promise<number> {
  if (symbol !== 'ETH') throw new Error('Kraken only supports ETH');
  const response = await fetch('https://api.kraken.com/0/public/Ticker?pair=ETHUSD', {
    next: { revalidate: 30 }
  });
  if (!response.ok) throw new Error('Kraken API failed');
  const data = await response.json();
  return parseFloat(data.result.XETHZUSD.c[0]);
}


const ETH_SOURCES: PriceSource[] = [
  { name: 'Binance', fetchPrice: fetchBinancePrice },
  { name: 'CoinGecko', fetchPrice: fetchCoinGeckoPrice },
  { name: 'Coinbase', fetchPrice: fetchCoinbasePrice },
  { name: 'Kraken', fetchPrice: fetchKrakenPrice },
];

const ZORA_SOURCES: PriceSource[] = [
  { name: 'CoinGecko', fetchPrice: fetchCoinGeckoPrice },
];

// Fallback prices for when all sources fail
const FALLBACK_PRICES: Record<string, number> = {
  'ETH': 3000,
  'ZORA': 0.5,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') || 'ETH').toUpperCase();
  
  // Select appropriate sources based on symbol
  const sources = symbol === 'ETH' ? ETH_SOURCES : symbol === 'ZORA' ? ZORA_SOURCES : null;
  
  if (!sources) {
    return NextResponse.json({ 
      error: `Symbol ${symbol} is not supported. Only ETH and ZORA are supported.` 
    }, { status: 400 });
  }

  let lastError: Error | null = null;
  
  // Try each source in order until one succeeds
  for (const source of sources) {
    try {
      console.log(`[CryptoPrice] Attempting to fetch ${symbol} from ${source.name}...`);
      const price = await source.fetchPrice(symbol);
      
      if (price && price > 0) {
        console.log(`[CryptoPrice] ✅ Success from ${source.name}: $${price}`);
        return NextResponse.json({
          success: true,
          price,
          source: source.name,
          symbol,
          timestamp: new Date().toISOString()
        }, {
          headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
          }
        });
      }
    } catch (error) {
      console.warn(`[CryptoPrice] ❌ ${source.name} failed:`, error);
      lastError = error as Error;
      continue; // Try next source
    }
  }

  // All sources failed - return fallback price
  const fallbackPrice = FALLBACK_PRICES[symbol] || 0;
  console.error(`[CryptoPrice] All sources failed for ${symbol}. Last error:`, lastError);
  return NextResponse.json({
    success: false,
    error: 'All price sources failed',
    fallbackPrice,
    symbol,
    lastError: lastError?.message
  }, { 
    status: 500,
    headers: {
      'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30'
    }
  });
}
