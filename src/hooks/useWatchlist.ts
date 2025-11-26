import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAccount } from "wagmi";
import { toast } from "react-hot-toast";
import { getCoinDetails } from "../services/sdk/getCoins";
import { getETHPrice } from "../services/cryptoPrice";

export interface WatchlistItem {
  token_address: string;
  added_at: string;
  added_price_eth?: number | string | null;
  added_price_usd?: number | string | null;
  added_price_timestamp?: string | null;
}

export interface WatchlistPriceHint {
  priceEth?: number | string | null;
  priceUsd?: number | string | null;
}

const toNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildPriceSnapshot = async (
  tokenAddress: string,
  hint?: WatchlistPriceHint
) => {
  let priceEth = toNumber(hint?.priceEth);
  let priceUsd = toNumber(hint?.priceUsd);
  const priceTimestamp = new Date().toISOString();

  try {
    if (priceEth === null || priceUsd === null) {
      const response: any = await getCoinDetails(tokenAddress);
      const tokenData = response?.zora20Token || response;
      const tokenPrice = tokenData?.tokenPrice;

      if (priceEth === null) {
        priceEth = toNumber(
          tokenPrice?.priceInPoolToken ??
            tokenPrice?.priceInEth ??
            tokenPrice?.priceInBase
        );
      }

      if (priceUsd === null) {
        priceUsd = toNumber(
          tokenPrice?.priceInUsdc ??
            tokenPrice?.priceInUsd ??
            tokenPrice?.priceInQuoteToken
        );
      }

      // getCoinDetails doesn't return fetchedAt, use current time or createdAt if needed, but current time is fine for snapshot
    }

    if (
      (priceEth === null || priceUsd === null) &&
      (priceEth !== null || priceUsd !== null)
    ) {
      try {
        const ethUsd = await getETHPrice();
        if (priceEth !== null && priceUsd === null && ethUsd) {
          priceUsd = priceEth * ethUsd;
        } else if (priceUsd !== null && priceEth === null && ethUsd) {
          priceEth = ethUsd !== 0 ? priceUsd / ethUsd : null;
        }
      } catch (conversionError) {
        console.warn(
          "Failed to fetch ETH price for watchlist snapshot",
          conversionError
        );
      }
    }
  } catch (error) {
    console.warn("Failed to capture watchlist price snapshot", error);
  }

  return {
    priceEth: priceEth ?? null,
    priceUsd: priceUsd ?? null,
    priceTimestamp,
  };
};

export function useWatchlist() {
  const { address } = useAccount();
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setWatchlist([]);
      setWatchlistItems([]);
      setLoading(false);
      return;
    }

    const fetchWatchlist = async () => {
      try {
        const { data, error } = await supabase
          .from("watchlists")
          .select(
            "token_address, added_at, added_price_eth, added_price_usd, added_price_timestamp"
          )
          .eq("user_address", address)
          .order("added_at", { ascending: false });

        if (error) throw error;

        setWatchlistItems(data || []);
        setWatchlist(data?.map((item) => item.token_address) || []);
      } catch (error) {
        console.error("Error fetching watchlist:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWatchlist();
  }, [address]);

  const addToWatchlist = async (
    tokenAddress: string,
    priceHint?: WatchlistPriceHint
  ) => {
    if (!address) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      const previousWatchlist = watchlist;
      const previousItems = watchlistItems;
      const insertedAt = new Date().toISOString();
      const snapshot = await buildPriceSnapshot(tokenAddress, priceHint);
      const optimisticItem: WatchlistItem = {
        token_address: tokenAddress,
        added_at: insertedAt,
        added_price_eth: snapshot.priceEth,
        added_price_usd: snapshot.priceUsd,
        added_price_timestamp: snapshot.priceTimestamp,
      };

      // Optimistic update
      setWatchlist((prev) => [...prev, tokenAddress]);
      setWatchlistItems((prev) => [optimisticItem, ...prev]);

      // Ensure user exists in the users table to avoid foreign key constraint errors
      const { error: userError } = await supabase
        .from("users")
        .upsert(
          { address: address },
          { onConflict: "address", ignoreDuplicates: true }
        );

      if (userError) {
        console.warn("Failed to ensure user exists:", userError);
        // We continue anyway, as the user might already exist and the error might be spurious
      }

      const { error } = await supabase.from("watchlists").insert({
        user_address: address,
        token_address: tokenAddress,
        added_price_eth: snapshot.priceEth,
        added_price_usd: snapshot.priceUsd,
        added_price_timestamp: snapshot.priceTimestamp,
      });

      if (error) {
        // Revert on error
        setWatchlist(previousWatchlist);
        setWatchlistItems(previousItems);
        throw error;
      }

      toast.success("Added to watchlist");
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      toast.error("Failed to add to watchlist");
    }
  };

  const removeFromWatchlist = async (tokenAddress: string) => {
    if (!address) return;

    try {
      const previousWatchlist = watchlist;
      const previousItems = watchlistItems;
      // Optimistic update
      setWatchlist((prev) => prev.filter((id) => id !== tokenAddress));
      setWatchlistItems((prev) =>
        prev.filter((item) => item.token_address !== tokenAddress)
      );

      const { error } = await supabase
        .from("watchlists")
        .delete()
        .eq("user_address", address)
        .eq("token_address", tokenAddress);

      if (error) {
        // Revert on error
        setWatchlist(previousWatchlist);
        setWatchlistItems(previousItems);
        throw error;
      }

      toast.success("Removed from watchlist");
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      toast.error("Failed to remove from watchlist");
    }
  };

  const isWatchlisted = (tokenAddress: string) => {
    return watchlist.includes(tokenAddress);
  };

  return {
    watchlist,
    watchlistItems,
    loading,
    addToWatchlist,
    removeFromWatchlist,
    isWatchlisted,
    toggleWatchlist: (tokenAddress: string, priceHint?: WatchlistPriceHint) => {
      if (isWatchlisted(tokenAddress)) {
        removeFromWatchlist(tokenAddress);
      } else {
        addToWatchlist(tokenAddress, priceHint);
      }
    },
  };
}
