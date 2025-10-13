import { useState, useEffect } from 'react';
import { getOnchainTokenDetails } from '../services/sdk/getOnchainData';
import { Coin } from '../lib/supabase';

interface TokenData {
  holders: number;
  liquidity: string;
  marketCap: string;
  loading: boolean;
  error: string | null;
}

// In-memory caching and rate-limit handling to prevent request loops
const CACHE_TTL_MS = 60_000; // 1 minute TTL
const cache = new Map<string, { data: TokenData; ts: number }>();
const pending = new Map<string, Promise<any>>();
let globalRateLimitUntil = 0;
const MAX_CONCURRENT = 3;
let activeCount = 0;
const queue: Array<() => void> = [];

function runLimited<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const exec = async () => {
      activeCount++;
      try {
        const res = await task();
        resolve(res);
      } catch (e) {
        reject(e);
      } finally {
        activeCount--;
        const next = queue.shift();
        if (next) next();
      }
    };
    if (activeCount < MAX_CONCURRENT) exec();
    else queue.push(exec);
  });
}

export function useTokenData(token: Coin | null, userAddress?: string): TokenData {
  const [data, setData] = useState<TokenData>({
    holders: 0,
    liquidity: '0',
    marketCap: '0',
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!token?.contract_address) {
      setData({
        holders: 0,
        liquidity: '0',
        marketCap: '0',
        loading: false,
        error: null,
      });
      return;
    }

    const fetchData = async () => {
      const address = token.contract_address.toLowerCase();

      // Serve from cache if fresh
      const now = Date.now();
      const cached = cache.get(address);
      if (cached && now - cached.ts < CACHE_TTL_MS) {
        setData({ ...cached.data, loading: false });
        return;
      }

      // Respect global rate-limit window
      if (globalRateLimitUntil > now) {
        setData({ holders: 0, liquidity: '0', marketCap: '0', loading: false, error: 'Rate limited. Try again shortly.' });
        return;
      }

      setData(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        // De-duplicate concurrent requests per address + limit concurrency
        let p = pending.get(address);
        if (!p) {
          p = runLimited(() => getOnchainTokenDetails(token.contract_address, userAddress));
          pending.set(address, p);
        }
        const details = await p;
        pending.delete(address);
        
        if (details && !details.hasError) {
          const mapped: TokenData = {
            holders: details.ownersCount || 0,
            liquidity: details.liquidity?.formatted || '0',
            marketCap: details.marketCap?.formatted || '0',
            loading: false,
            error: null,
          };
          cache.set(address, { data: mapped, ts: Date.now() });
          setData(mapped);
        } else {
          if (details?.rateLimited || details?.error === 'RATE_LIMIT') {
            globalRateLimitUntil = Date.now() + 30_000; // 30s cooldown
            const mapped: TokenData = { holders: 0, liquidity: '0', marketCap: '0', loading: false, error: 'Rate limited. Try again shortly.' };
            cache.set(address, { data: mapped, ts: Date.now() });
            setData(mapped);
          } else {
            const mapped: TokenData = { holders: 0, liquidity: '0', marketCap: '0', loading: false, error: 'Failed to load token data' };
            cache.set(address, { data: mapped, ts: Date.now() });
            setData(mapped);
          }
        }
      } catch (error: any) {
        console.error('Error fetching token data:', error);
        const address = token.contract_address.toLowerCase();
        const msg = String(error?.message || '').toLowerCase();
        if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
          globalRateLimitUntil = Date.now() + 30_000;
          const mapped: TokenData = { holders: 0, liquidity: '0', marketCap: '0', loading: false, error: 'Rate limited. Try again shortly.' };
          cache.set(address, { data: mapped, ts: Date.now() });
          setData(mapped);
        } else {
          const mapped: TokenData = { holders: 0, liquidity: '0', marketCap: '0', loading: false, error: error.message || 'Failed to load token data' };
          cache.set(address, { data: mapped, ts: Date.now() });
          setData(mapped);
        }
      }
    };

    fetchData();
  }, [token?.contract_address, userAddress]);

  return data;
}

