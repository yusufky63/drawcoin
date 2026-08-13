"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";

import {
  createCreatorAddressBatch,
  MAX_CREATOR_IDENTITY_BATCH,
} from "../../lib/creatorIdentity";
import type { Coin } from "../../lib/supabase";
import { useWatchlist } from "../../hooks/useWatchlist";
import TokenFilters, {
  type CreationType,
  type MarketSort,
} from "./TokenFilters";
import TokenGrid from "./TokenGrid";
import HandDrawnSkeleton from "../ui/HandDrawnSkeleton";

const PAGE_SIZE = 24;
const validSorts = new Set<MarketSort>([
  "newest",
  "oldest",
  "most-watched",
]);
const validCreationTypes = new Set<CreationType>(["all", "ai", "hand-drawn"]);

interface MarketMeta {
  limit: number;
  page: number;
  total: number;
  totalPages: number;
}

interface MarketResponse {
  data: Coin[];
  meta: MarketMeta;
}

interface BasenamesResponse {
  basenames: Record<string, string | null>;
}

class ApiResponseError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiResponseError";
    this.status = status;
  }
}

async function fetcher(url: string): Promise<MarketResponse> {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  const payload = (await response.json().catch(() => null)) as
    | MarketResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    const message =
      payload && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Market data could not be loaded.";
    throw new ApiResponseError(message, response.status);
  }
  if (!payload || !("data" in payload) || !("meta" in payload)) {
    throw new ApiResponseError("The server returned an invalid response.", 502);
  }
  return payload;
}

async function fetchBasenames(url: string): Promise<BasenamesResponse> {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new ApiResponseError(
      "Creator names could not be loaded.",
      response.status
    );
  }
  return (await response.json()) as BasenamesResponse;
}

function uniqueCoins(pages?: MarketResponse[]) {
  const seen = new Set<string>();
  const coins: Coin[] = [];

  for (const page of pages ?? []) {
    for (const coin of page.data) {
      const key = coin.contract_address.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      coins.push(coin);
    }
  }
  return coins;
}

export default function MarketPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<MarketSort>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [creationType, setCreationType] = useState<CreationType>("all");
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const [filtersReady, setFiltersReady] = useState(false);
  const marketTopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = (params.get("q") ?? "").slice(0, 100);
    const requestedSort = params.get("sort") as MarketSort | null;
    const requestedType = params.get("type") as CreationType | null;
    const creator = params.get("creator")?.trim().toLowerCase() ?? "";

    setSearchTerm(query);
    setDebouncedSearch(query.trim());
    if (requestedSort && validSorts.has(requestedSort)) setSortBy(requestedSort);
    if (requestedType && validCreationTypes.has(requestedType)) {
      setCreationType(requestedType);
    }
    if (/^0x[a-f0-9]{40}$/.test(creator)) setSelectedCreator(creator);
    setFiltersReady(true);
  }, []);

  const apiSearch = selectedCreator ?? debouncedSearch;
  const getKey = useCallback(
    (pageIndex: number, previousPage: MarketResponse | null) => {
      if (!filtersReady) return null;
      if (previousPage && pageIndex >= previousPage.meta.totalPages) return null;

      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(pageIndex + 1),
        sort: sortBy,
      });
      if (apiSearch) params.set("search", apiSearch);
      if (creationType !== "all") params.set("creationType", creationType);
      return `/api/market?${params.toString()}`;
    },
    [apiSearch, creationType, filtersReady, sortBy]
  );

  const {
    data: pages,
    error,
    isLoading,
    isValidating,
    mutate: retryMarket,
    setSize,
    size,
  } = useSWRInfinite<MarketResponse, ApiResponseError>(getKey, fetcher, {
    persistSize: false,
    revalidateFirstPage: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    errorRetryCount: 1,
    errorRetryInterval: 2_000,
  });

  useEffect(() => {
    if (!filtersReady) return;
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      void setSize(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [filtersReady, searchTerm, setSize]);

  useEffect(() => {
    if (!filtersReady) return;
    const params = new URLSearchParams(window.location.search);
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    else params.delete("q");
    if (sortBy !== "newest") params.set("sort", sortBy);
    else params.delete("sort");
    if (creationType !== "all") params.set("type", creationType);
    else params.delete("type");
    if (selectedCreator) params.set("creator", selectedCreator);
    else params.delete("creator");

    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`
    );
  }, [creationType, filtersReady, searchTerm, selectedCreator, sortBy]);

  const tokens = useMemo(() => uniqueCoins(pages), [pages]);
  const creatorAddressKey = useMemo(
    () =>
      createCreatorAddressBatch(
        tokens.map((token) => token.creator_address),
        MAX_CREATOR_IDENTITY_BATCH
      ).join(","),
    [tokens]
  );
  const { data: creatorIdentityData } = useSWR<
    BasenamesResponse,
    ApiResponseError
  >(
    creatorAddressKey
      ? `/api/basenames?addresses=${encodeURIComponent(creatorAddressKey)}`
      : null,
    fetchBasenames,
    {
      dedupingInterval: 30 * 60 * 1000,
      errorRetryCount: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );
  const meta = pages?.[0]?.meta;
  const total = meta?.total ?? 0;
  const lastPage = pages?.[pages.length - 1];
  const hasMore = Boolean(
    lastPage && lastPage.meta.page < lastPage.meta.totalPages
  );
  const loadingMore = isValidating && size > (pages?.length ?? 0);

  const [watchlistStats, setWatchlistStats] = useState<Record<string, number>>({});
  const watchlistStatsRef = useRef<Record<string, number>>({});
  const [watchlistStatsRefresh, setWatchlistStatsRefresh] = useState<{
    address: string;
    sequence: number;
  } | null>(null);
  const tokenAddressKey = useMemo(
    () =>
      Array.from(
        new Set(
          tokens
            .map((token) => token.contract_address.trim().toLowerCase())
            .filter((address) => /^0x[a-f0-9]{40}$/.test(address))
        )
      ).join(","),
    [tokens]
  );

  useEffect(() => {
    if (!tokenAddressKey) return;
    const controller = new AbortController();
    const visibleAddresses = tokenAddressKey.split(",");
    const missing = watchlistStatsRefresh
      ? visibleAddresses.filter(
          (address) => address === watchlistStatsRefresh.address
        )
      : visibleAddresses.filter(
          (address) =>
            !Object.prototype.hasOwnProperty.call(
              watchlistStatsRef.current,
              address
            )
        );
    if (missing.length === 0) {
      if (watchlistStatsRefresh) setWatchlistStatsRefresh(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const received: Record<string, number> = {};
          for (let index = 0; index < missing.length; index += 100) {
            const response = await fetch("/api/market/stats", {
              method: "POST",
              credentials: "same-origin",
              signal: controller.signal,
              headers: { Accept: "application/json", "Content-Type": "application/json" },
              body: JSON.stringify({ tokens: missing.slice(index, index + 100) }),
            });
            if (!response.ok) throw new Error(`Watchlist stats failed (${response.status}).`);
            const payload = (await response.json()) as { data?: Record<string, unknown> };
            for (const [address, count] of Object.entries(payload.data ?? {})) {
              const numeric = Number(count);
              received[address.toLowerCase()] = Number.isFinite(numeric)
                ? Math.max(0, Math.floor(numeric))
                : 0;
            }
          }
          const next = { ...watchlistStatsRef.current, ...received };
          watchlistStatsRef.current = next;
          setWatchlistStats(next);
        } catch (statsError) {
          if (!(statsError instanceof DOMException && statsError.name === "AbortError")) {
            console.error("Failed to fetch watchlist stats", statsError);
          }
        } finally {
          if (watchlistStatsRefresh && !controller.signal.aborted) {
            setWatchlistStatsRefresh((current) =>
              current?.address === watchlistStatsRefresh.address &&
              current.sequence === watchlistStatsRefresh.sequence
                ? null
                : current
            );
          }
        }
      })();
    }, 200);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [tokenAddressKey, watchlistStatsRefresh]);

  const visibleWatchlistStats = useMemo(
    () =>
      Object.fromEntries(
        tokens.map((token) => [
          token.contract_address,
          watchlistStats[token.contract_address.toLowerCase()] ?? 0,
        ])
      ),
    [tokens, watchlistStats]
  );
  const { watchlist, toggleWatchlist } = useWatchlist();
  const watchlistSet = useMemo(
    () => new Set(watchlist.map((address) => address.toLowerCase())),
    [watchlist]
  );

  const handleToggleWatchlist = useCallback(
    async (
      tokenAddress: string,
      priceHint?: Parameters<typeof toggleWatchlist>[1]
    ) => {
      const normalizedAddress = tokenAddress.toLowerCase();
      const wasWatchlisted = watchlistSet.has(normalizedAddress);
      const succeeded = await toggleWatchlist(tokenAddress, priceHint);
      if (!succeeded) return;

      const nextStats = {
        ...watchlistStatsRef.current,
        [normalizedAddress]: Math.max(
          0,
          (watchlistStatsRef.current[normalizedAddress] ?? 0) +
            (wasWatchlisted ? -1 : 1)
        ),
      };
      watchlistStatsRef.current = nextStats;
      setWatchlistStats(nextStats);
      setWatchlistStatsRefresh((current) => ({
        address: normalizedAddress,
        sequence: (current?.sequence ?? 0) + 1,
      }));

      if (sortBy === "most-watched") {
        void retryMarket();
      }
    },
    [retryMarket, sortBy, toggleWatchlist, watchlistSet]
  );

  const resetToFirstPage = useCallback(() => {
    void setSize(1);
    marketTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [setSize]);

  const showLoading = !filtersReady || (isLoading && tokens.length === 0);
  if (showLoading) {
    return (
      <div className="min-h-[420px] bg-art-off-white">
        <div className="mx-auto max-w-7xl px-3 pt-4 sm:px-4">
          <div className="mb-5 flex items-center justify-between gap-4">
            <HandDrawnSkeleton variant="text" className="h-8 w-56" />
            <HandDrawnSkeleton variant="text" className="hidden h-8 w-24 sm:block" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HandDrawnSkeleton variant="card" count={8} />
          </div>
        </div>
      </div>
    );
  }

  if (error && tokens.length === 0) {
    return (
      <div className="min-h-[420px] bg-art-off-white px-3 pt-8">
        <div className="mx-auto max-w-3xl rounded-2xl border-2 border-[#2d3748] bg-amber-50 p-6 text-center shadow-[3px_3px_0_#2d3748]" role="alert">
          <h2 className="font-bold text-art-gray-900">Market data is temporarily unavailable</h2>
          <p className="mb-4 mt-2 text-sm text-art-gray-600">{error.message}</p>
          <button type="button" onClick={() => void retryMarket()} disabled={isValidating} className="rounded-xl border-2 border-[#2d3748] bg-[#0052ff] px-4 py-2 text-sm font-bold text-white shadow-[2px_2px_0_#2d3748] disabled:opacity-60">
            {isValidating ? "Retrying..." : "Try again"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-art-off-white">
      <div ref={marketTopRef} className="mx-auto max-w-7xl scroll-mt-28 px-3 pt-2 sm:px-4 sm:pt-4">
        <div className="mb-3 flex items-end justify-between gap-3 sm:mb-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0052ff] sm:text-[11px]">Community sketchbook</p>
            <div className="mt-0.5 flex min-w-0 items-baseline gap-2.5">
              <h2 className="truncate font-art-sans text-2xl font-bold leading-tight tracking-[-0.025em] text-art-gray-900 sm:text-3xl md:text-4xl">Fresh from the canvas</h2>
              <span className="shrink-0 rounded-full border border-[#0052ff]/30 bg-[#eef3ff] px-2 py-0.5 text-[10px] font-black text-[#003ecb] sm:text-xs" aria-live="polite">
                {total} works
              </span>
            </div>
          </div>
          <p className="hidden max-w-sm text-right text-sm leading-5 text-art-gray-600 lg:block">Original drawings launched by the DrawCoin community on Base.</p>
        </div>

        {error ? (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs" role="status">
            <span>Live data could not be refreshed. Showing the last loaded results.</span>
            <button type="button" onClick={() => void retryMarket()} className="shrink-0 font-bold underline">Retry</button>
          </div>
        ) : null}

        <TokenFilters
          searchTerm={searchTerm}
          onSearchChange={(value) => {
            setSelectedCreator(null);
            setSearchTerm(value);
          }}
          sortBy={sortBy}
          onSortChange={(value) => {
            setSortBy(value);
            resetToFirstPage();
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          creationType={creationType}
          onCreationTypeChange={(value) => {
            setCreationType(value);
            resetToFirstPage();
          }}
        />

        <div className="mb-2 flex min-h-7 items-center justify-between gap-3 text-[11px] text-art-gray-500 sm:text-xs">
          <p aria-live="polite">
            {selectedCreator
              ? `${total} works by this creator`
              : `Showing ${tokens.length} of ${total} works`}
          </p>
          {isValidating && !loadingMore ? <span>Refreshing...</span> : null}
        </div>

        {selectedCreator ? (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[#0052ff]/30 bg-[#eef3ff] px-3 py-2 text-xs text-[#003ecb]">
            <p className="truncate font-bold">Creator: {selectedCreator.slice(0, 6)}…{selectedCreator.slice(-4)}</p>
            <button type="button" onClick={() => { setSelectedCreator(null); resetToFirstPage(); }} className="shrink-0 font-black uppercase tracking-wide underline underline-offset-2">Clear</button>
          </div>
        ) : null}

        {tokens.length > 0 ? (
          <TokenGrid
            tokens={tokens}
            loading={false}
            viewMode={viewMode}
            watchlistSet={watchlistSet}
            onToggleWatchlist={handleToggleWatchlist}
            onCreatorClick={(creatorAddress) => {
              setSearchTerm("");
              setDebouncedSearch("");
              setSelectedCreator(creatorAddress.toLowerCase());
              resetToFirstPage();
            }}
            watchlistStats={visibleWatchlistStats}
            creatorBasenames={creatorIdentityData?.basenames}
          />
        ) : (
          <div className="rounded-2xl border-2 border-[#2d3748] bg-white px-5 py-10 text-center shadow-[3px_3px_0_#2d3748]">
            <h3 className="font-bold text-art-gray-900">No works found</h3>
            <p className="mt-1 text-sm text-art-gray-500">Try a different search or filter.</p>
          </div>
        )}

        <div className="py-6 text-center sm:py-8">
          {hasMore ? (
            <button
              type="button"
              onClick={() => void setSize((current) => current + 1)}
              disabled={loadingMore}
              className="min-h-11 rounded-xl border-2 border-[#2d3748] bg-white px-5 py-2.5 text-sm font-bold text-art-gray-900 shadow-[2px_2px_0_#2d3748] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
            >
              {loadingMore ? "Loading..." : "Load 24 more"}
            </button>
          ) : tokens.length > 0 ? (
            <p className="text-xs text-art-gray-500">You have reached the end of the collection.</p>
          ) : null}
        </div>
      </div>

    </div>
  );
}
