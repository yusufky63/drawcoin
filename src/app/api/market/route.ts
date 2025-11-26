import { NextResponse } from 'next/server';
import { CoinService } from '@/services/coinService';
import { getCoinsBatchWithRetry } from '@/services/zoraService';

// Force dynamic to ensure we get fresh data when needed, though we use caching headers
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    // Default limit is 100, but allow up to 5000 if requested (for client-side filtering)
    const limitParam = searchParams.get('limit');
    const limit = limitParam === 'all' ? 5000 : parseInt(limitParam || '100'); 
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'newest';
    const creationType = searchParams.get('creationType') || '';
    
    // Calculate offset
    const offset = (page - 1) * limit;

    // 1. Fetch basic data from Supabase (Paginated)
    // We fetch from DB first to get the "base" list of tokens
    const [dbCoins, total] = await Promise.all([
      CoinService.getCoins({ limit, offset, search, sort, creation_type: creationType }),
      CoinService.getTotalCoinsCount()
    ]);

    // 2. If Search is active, return Supabase data immediately (No Zora)
    // This ensures search is lightning fast and doesn't hit Zora API limits
    if (search) {
      return NextResponse.json({
        data: dbCoins,
        meta: { 
          total, 
          page, 
          limit, 
          totalPages: Math.ceil(total / limit) 
        }
      }, {
        headers: {
          // Aggressive caching for search results
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' 
        }
      });
    }

    // 3. For Main List: Fetch Zora data in parallel batches
    // We only enrich with Zora data for the main list view
    const addresses = dbCoins.map(c => c.contract_address);
    let enrichedCoins = dbCoins;

    if (addresses.length > 0) {
      try {
        // Split 100 addresses into chunks of 20 to respect rate limits
        const chunkSize = 20;
        const chunks = [];
        for (let i = 0; i < addresses.length; i += chunkSize) {
          chunks.push(addresses.slice(i, i + chunkSize));
        }

        // Fetch all chunks in parallel with our robust retry logic
        // This makes it much faster than sequential fetching
        const results = await Promise.all(
          chunks.map(chunk => getCoinsBatchWithRetry(chunk))
        );

        // Combine results from all chunks
        const zoraData = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
        
        // Merge Zora data into our DB coins
        enrichedCoins = dbCoins.map(coin => {
          const zoraInfo = zoraData[coin.contract_address.toLowerCase()];
          
          if (zoraInfo) {
             // Map Zora data to our Coin structure
             // We prioritize Zora data for dynamic fields like price/volume
             return {
               ...coin,
               ...zoraInfo,
               // Ensure we keep critical DB fields if Zora misses them
               id: coin.id, 
               contract_address: coin.contract_address,
               // Map specific Zora fields that might have different names
               current_price: zoraInfo.tokenPrice?.priceInPoolToken || coin.current_price || '0',
               volume_24h: zoraInfo.volume24h || zoraInfo.totalVolume || coin.volume_24h || '0',
               holders: zoraInfo.uniqueHolders || coin.holders || 0,
               marketCap: zoraInfo.marketCap,
               change24hPct: zoraInfo.marketCapDelta24h
             };
          }
          return coin;
        });
      } catch (error) {
        console.error('Failed to fetch Zora data:', error);
        // If Zora fails completely (even after retries), we still return the DB data
        // This ensures the UI never breaks, just shows slightly stale data
      }
    }

    return NextResponse.json({
      data: enrichedCoins,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }, {
      headers: {
        // Standard caching for main list
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30'
      }
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
