import { useState, useEffect, useMemo } from "react";
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

const DEVICE_WATCHLIST_KEY = "drawcoin:device-watchlist:v1";

function readDeviceWatchlist() {
  try {
    const stored = window.localStorage.getItem(DEVICE_WATCHLIST_KEY);
    const parsed = stored ? (JSON.parse(stored) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (value): value is string =>
        typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)
    );
  } catch {
    return [];
  }
}

function writeDeviceWatchlist(addresses: string[]) {
  try {
    window.localStorage.setItem(DEVICE_WATCHLIST_KEY, JSON.stringify(addresses));
  } catch {
    // Device saves are best-effort; server-backed watchlists remain unaffected.
  }
}

export function useWatchlist() {
  const { address } = useAccount();
  const { session, status: sessionStatus } = useWalletSession();
  const [serverWatchlist, setServerWatchlist] = useState<string[]>([]);
  const [deviceWatchlist, setDeviceWatchlist] = useState<string[]>([]);
  const [serverWatchlistItems, setServerWatchlistItems] = useState<
    WatchlistItem[]
  >([]);
  const [deviceWatchlistItems, setDeviceWatchlistItems] = useState<
    WatchlistItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [deviceLoading, setDeviceLoading] = useState(false);

  useEffect(() => {
    setDeviceWatchlist(readDeviceWatchlist());
  }, []);

  const watchlist = useMemo(() => {
    const combined = new Map<string, string>();
    for (const item of [...deviceWatchlist, ...serverWatchlist]) {
      combined.set(item.toLowerCase(), item);
    }
    return Array.from(combined.values());
  }, [deviceWatchlist, serverWatchlist]);

  const watchlistItems = useMemo(() => {
    const combined = new Map<string, WatchlistItem>();
    for (const item of deviceWatchlistItems) {
      combined.set(item.token_address.toLowerCase(), item);
    }
    // Server-backed rows carry the original save timestamp and price snapshot,
    // so they take precedence when the same token also exists on this device.
    for (const item of serverWatchlistItems) {
      combined.set(item.token_address.toLowerCase(), item);
    }
    return Array.from(combined.values());
  }, [deviceWatchlistItems, serverWatchlistItems]);

  const updateDeviceWatchlist = (
    updater: (current: string[]) => string[]
  ) => {
    setDeviceWatchlist((current) => {
      const next = updater(current);
      writeDeviceWatchlist(next);
      return next;
    });
  };

  useEffect(() => {
    if (deviceWatchlist.length === 0) {
      setDeviceWatchlistItems([]);
      setDeviceLoading(false);
      return;
    }

    const controller = new AbortController();
    const loadDeviceCoins = async () => {
      setDeviceLoading(true);
      try {
        const query = encodeURIComponent(deviceWatchlist.join(","));
        const response = await fetch(`/api/watchlist/coins?addresses=${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          items?: WatchlistItem[];
          error?: string;
        };
        if (!response.ok) throw new Error(body.error || "Watchlist unavailable");
        setDeviceWatchlistItems(body.items ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Error loading device watchlist:", error);
        }
      } finally {
        if (!controller.signal.aborted) setDeviceLoading(false);
      }
    };

    void loadDeviceCoins();
    return () => controller.abort();
  }, [deviceWatchlist]);

  useEffect(() => {
    if (!address || sessionStatus !== "authenticated" || !session) {
      setServerWatchlist([]);
      setServerWatchlistItems([]);
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
        setServerWatchlistItems(items);
        setServerWatchlist(items.map((item) => item.token_address));
        setDeviceWatchlist((current) => {
          const combined = new Map(
            current.map((tokenAddress) => [tokenAddress.toLowerCase(), tokenAddress])
          );
          for (const item of items) {
            combined.set(item.token_address.toLowerCase(), item.token_address);
          }
          const next = Array.from(combined.values());
          writeDeviceWatchlist(next);
          return next;
        });
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
    const normalizedAddress = tokenAddress.toLowerCase();
    if (!address || sessionStatus !== "authenticated" || !session) {
      updateDeviceWatchlist((current) =>
        current.some((item) => item.toLowerCase() === normalizedAddress)
          ? current
          : [...current, tokenAddress]
      );
      toast.success("Saved on this device");
      return true;
    }

    try {
      const previousWatchlist = serverWatchlist;
      const previousItems = serverWatchlistItems;
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
      setServerWatchlist((prev) =>
        prev.some((item) => item.toLowerCase() === normalizedAddress)
          ? prev
          : [...prev, tokenAddress]
      );
      setServerWatchlistItems((prev) =>
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
        setServerWatchlist(previousWatchlist);
        setServerWatchlistItems(previousItems);
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || "Failed to add watchlist item");
      }

      updateDeviceWatchlist((current) =>
        current.some((item) => item.toLowerCase() === normalizedAddress)
          ? current
          : [...current, tokenAddress]
      );
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
    const normalizedAddress = tokenAddress.toLowerCase();
    const existsOnServer = serverWatchlist.some(
      (item) => item.toLowerCase() === normalizedAddress
    );

    if (
      !address ||
      sessionStatus !== "authenticated" ||
      !session ||
      !existsOnServer
    ) {
      updateDeviceWatchlist((current) =>
        current.filter((item) => item.toLowerCase() !== normalizedAddress)
      );
      toast.success("Removed from this device");
      return true;
    }

    try {
      const previousWatchlist = serverWatchlist;
      const previousItems = serverWatchlistItems;
      // Optimistic update
      setServerWatchlist((prev) =>
        prev.filter((id) => id.toLowerCase() !== normalizedAddress)
      );
      setServerWatchlistItems((prev) =>
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
        setServerWatchlist(previousWatchlist);
        setServerWatchlistItems(previousItems);
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || "Failed to remove watchlist item");
      }

      toast.success("Removed from watchlist");
      updateDeviceWatchlist((current) =>
        current.filter((item) => item.toLowerCase() !== normalizedAddress)
      );
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
    loading: loading || deviceLoading,
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
