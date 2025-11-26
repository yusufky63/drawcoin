import axios from "axios";

const BASE_URL = "https://api.geckoterminal.com/api/v2";

export interface OHLCVData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Simple in-memory cache to avoid hitting rate limits
const cache = new Map<string, { data: OHLCVData[]; ts: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

export async function getOHLCV(
  network: string,
  poolAddress: string,
  timeframe: "day" | "hour" | "minute",
  aggregate: number = 1
): Promise<OHLCVData[]> {
  const cacheKey = `${network}-${poolAddress}-${timeframe}-${aggregate}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Endpoint: /networks/{network}/pools/{pool_address}/ohlcv/{timeframe}
    const url = `${BASE_URL}/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}`;

    const response = await axios.get(url, {
      params: {
        aggregate,
        limit: 1000, // Get max data
      },
    });

    const rawData = response.data?.data?.attributes?.ohlcv_list;

    if (!rawData || !Array.isArray(rawData)) {
      return [];
    }

    // GeckoTerminal returns [timestamp, open, high, low, close, volume]
    // We need to map it to an object and SORT it by time ascending for lightweight-charts
    const formattedData: OHLCVData[] = rawData
      .map((item: any[]) => ({
        time: item[0], // Unix timestamp in seconds
        open: item[1],
        high: item[2],
        low: item[3],
        close: item[4],
        volume: item[5],
      }))
      .sort((a, b) => a.time - b.time); // Sort ascending

    cache.set(cacheKey, { data: formattedData, ts: Date.now() });
    return formattedData;
  } catch (error) {
    console.error("Error fetching OHLCV data:", error);
    return [];
  }
}
