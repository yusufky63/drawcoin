import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { toast } from "react-hot-toast";
import type { SupabaseCoinSnapshot } from "../lib/market/coinSnapshot";
import { useWalletSession } from "./useWalletSession";

export interface WatchlistItem {
  token_address: string;
  added_at: string;
  added_price_eth?: number | string | null;
  added_price_usd?: number | string | null;
  added_price_timestamp?: string | null;
  verified_at?: string | null;
  coin?: SupabaseCoinSnapshot | null;
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

const buildPriceSnapshot = (hint?: WatchlistPriceHint) => {
  const priceEth = toNumber(hint?.priceEth);
  const priceUsd = toNumber(hint?.priceUsd);
  return {
    priceEth: priceEth ?? null,
    priceUsd: priceUsd ?? null,
    priceTimestamp: new Date().toISOString(),
  };
};

export function useWatchlist() {
  const { address } = useAccount();
  const { session, status: sessionStatus, signIn } = useWalletSession();
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address || sessionStatus !== "authenticated" || !session) {
      setWatchlist([]);
      setWatchlistItems([]);
      setLoading(Boolean(address) && sessionStatus === "loading");
      return;
    }

    const fetchWatchlist = async () => {
      try {
        const response = await fetch("/api/watchlist", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const body = (await response.json()) as {
          items?: WatchlistItem[];
          error?: string;
        };
        if (!response.ok) throw new Error(body.error || "Watchlist unavailable");

        const items = body.items || [];
        setWatchlistItems(items);
        setWatchlist(items.map((item) => item.token_address));
      } catch (error) {
        console.error("Error fetching watchlist:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWatchlist();
  }, [address, session, sessionStatus]);

  const addToWatchlist = async (
    tokenAddress: string,
    priceHint?: WatchlistPriceHint
  ): Promise<boolean> => {
    if (!address) {
      toast.error("Please connect your wallet");
      return false;
    }

    try {
      if (sessionStatus !== "authenticated" || !session) {
        await signIn();
      }

      const previousWatchlist = watchlist;
      const previousItems = watchlistItems;
      const insertedAt = new Date().toISOString();
      const snapshot = buildPriceSnapshot(priceHint);
      const optimisticItem: WatchlistItem = {
        token_address: tokenAddress,
        added_at: insertedAt,
        added_price_eth: snapshot.priceEth,
        added_price_usd: snapshot.priceUsd,
        added_price_timestamp: snapshot.priceTimestamp,
      };

      // Optimistic update
      const normalizedAddress = tokenAddress.toLowerCase();
      setWatchlist((prev) =>
        prev.some((item) => item.toLowerCase() === normalizedAddress)
          ? prev
          : [...prev, tokenAddress]
      );
      setWatchlistItems((prev) =>
        prev.some(
          (item) => item.token_address.toLowerCase() === normalizedAddress
        )
          ? prev
          : [optimisticItem, ...prev]
      );

      const response = await fetch("/api/watchlist", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenAddress,
          priceEth: snapshot.priceEth,
          priceUsd: snapshot.priceUsd,
          priceTimestamp: snapshot.priceTimestamp,
        }),
      });

      if (!response.ok) {
        // Revert on error
        setWatchlist(previousWatchlist);
        setWatchlistItems(previousItems);
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || "Failed to add watchlist item");
      }

      toast.success("Added to watchlist");
      return true;
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      toast.error("Failed to add to watchlist");
      return false;
    }
  };

  const removeFromWatchlist = async (
    tokenAddress: string
  ): Promise<boolean> => {
    if (!address) return false;

    try {
      if (sessionStatus !== "authenticated" || !session) {
        await signIn();
      }

      const previousWatchlist = watchlist;
      const previousItems = watchlistItems;
      const normalizedAddress = tokenAddress.toLowerCase();
      // Optimistic update
      setWatchlist((prev) =>
        prev.filter((id) => id.toLowerCase() !== normalizedAddress)
      );
      setWatchlistItems((prev) =>
        prev.filter(
          (item) => item.token_address.toLowerCase() !== normalizedAddress
        )
      );

      const response = await fetch("/api/watchlist", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenAddress }),
      });

      if (!response.ok) {
        // Revert on error
        setWatchlist(previousWatchlist);
        setWatchlistItems(previousItems);
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || "Failed to remove watchlist item");
      }

      toast.success("Removed from watchlist");
      return true;
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      toast.error("Failed to remove from watchlist");
      return false;
    }
  };

  const isWatchlisted = (tokenAddress: string) => {
    const normalizedAddress = tokenAddress.toLowerCase();
    return watchlist.some(
      (item) => item.toLowerCase() === normalizedAddress
    );
  };

  return {
    watchlist,
    watchlistItems,
    loading,
    requiresSignIn:
      Boolean(address) && sessionStatus === "unauthenticated",
    verifyWallet: signIn,
    addToWatchlist,
    removeFromWatchlist,
    isWatchlisted,
    toggleWatchlist: async (
      tokenAddress: string,
      priceHint?: WatchlistPriceHint
    ): Promise<boolean> => {
      if (isWatchlisted(tokenAddress)) {
        return removeFromWatchlist(tokenAddress);
      }
      return addToWatchlist(tokenAddress, priceHint);
    },
  };
}
