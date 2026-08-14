import type { Coin } from "@/lib/supabase";

export const COIN_SNAPSHOT_COLUMNS = [
  "id",
  "name",
  "symbol",
  "description",
  "contract_address",
  "image_url",
  "category",
  "creator_address",
  "creator_name",
  "chain_id",
  "currency",
  "total_supply",
  "current_price",
  "market_cap",
  "volume_24h",
  "holders",
  "last_trade_at",
  "last_trade_type",
  "verified_trade_count",
  "created_at",
  "updated_at",
  "creation_type",
  "watchlist_count",
  "last_synced_at",
].join(",");

export type SupabaseCoinSnapshot = Omit<
  Coin,
  | "change24hPct"
  | "marketCap"
  | "market_cap"
  | "tokenPrice"
  | "totalSupply"
  | "uniqueHolders"
  | "volume24h"
> & {
  dataSource: "supabase";
  creatorProfile?: { handle: string };
  marketCap?: number;
  market_cap?: number;
  marketCapDelta24h?: number;
  price_change_24h?: number;
  metricsUpdatedAt: string | null;
  tokenPrice?: { priceInUsd: number };
  totalSupply?: number;
  uniqueHolders?: number;
  volume24h?: number;
  watchlist_count?: number;
};

function finiteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;

  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function nonNegativeNumber(value: unknown): number | undefined {
  const numeric = finiteNumber(value);
  return numeric !== undefined && numeric >= 0 ? numeric : undefined;
}

function positiveNumber(value: unknown): number | undefined {
  const numeric = finiteNumber(value);
  return numeric !== undefined && numeric > 0 ? numeric : undefined;
}

function normalizedTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

/**
 * Builds the public market DTO exclusively from DrawCoin's persisted Supabase
 * snapshot. A missing metric stays missing; zeroes and 24h changes are never
 * fabricated to imitate a live market response.
 */
export function toSupabaseCoinSnapshot(coin: Coin): SupabaseCoinSnapshot {
  const price = positiveNumber(coin.current_price);
  const supply = positiveNumber(coin.total_supply);
  const volume = nonNegativeNumber(coin.volume_24h);
  const holders = nonNegativeNumber(coin.holders);
  const watchlistCount = nonNegativeNumber(
    (coin as Coin & { watchlist_count?: unknown }).watchlist_count
  );
  const derivedMarketCap =
    price !== undefined && supply !== undefined
      ? price * supply
      : undefined;
  const persistedMarketCap = nonNegativeNumber(coin.market_cap);
  const marketCap =
    persistedMarketCap ??
    (derivedMarketCap !== undefined && Number.isFinite(derivedMarketCap)
      ? derivedMarketCap
      : undefined);
  const creatorHandle = coin.creator_name?.trim();

  return {
    ...coin,
    current_price: price,
    total_supply: supply,
    volume_24h: volume,
    holders,
    watchlist_count: watchlistCount,
    dataSource: "supabase",
    creatorProfile: creatorHandle ? { handle: creatorHandle } : undefined,
    marketCap,
    market_cap: marketCap,
    metricsUpdatedAt: normalizedTimestamp(coin.last_synced_at),
    tokenPrice: price === undefined ? undefined : { priceInUsd: price },
    totalSupply: supply,
    uniqueHolders: holders,
    volume24h: volume,
  };
}
