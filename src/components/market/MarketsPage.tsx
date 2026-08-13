"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import {
  Clock3,
  Heart,
  LayoutGrid,
  Search,
  Table2,
  TrendingUp,
  X,
} from "lucide-react";

import {
  createCreatorAddressBatch,
  getCreatorDisplayLabel,
  MAX_CREATOR_IDENTITY_BATCH,
  normalizeCreatorAddress,
} from "@/lib/creatorIdentity";
import {
  formatCoinAge,
  formatCompactUsd,
  formatInteger,
} from "@/lib/market/formatters";
import type { SupabaseCoinSnapshot } from "@/lib/market/coinSnapshot";
import { CreationTypeBadge } from "@/components/market/CreationTypeBadge";
import { SafeImage } from "@/components/ui/SafeImage";
import { useWatchlist } from "@/hooks/useWatchlist";

const PAGE_SIZE = 40;
const VISIBLE_CREATOR_BATCH_SIZE = 100;

type MarketsSort = "newest" | "market-cap";
type MarketsView = "table" | "gallery";

type MarketMeta = {
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

type MarketResponse = {
  data: SupabaseCoinSnapshot[];
  meta: MarketMeta;
  source: "supabase";
};

type BasenamesResponse = {
  basenames: Record<string, string | null>;
};

class MarketsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchMarkets(url: string): Promise<MarketResponse> {
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
    throw new MarketsApiError(
      payload && "error" in payload && payload.error
        ? payload.error
        : "Markets could not be loaded.",
      response.status
    );
  }
  if (!payload || !("data" in payload) || !("meta" in payload)) {
    throw new MarketsApiError("Markets returned an invalid response.", 502);
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
    throw new MarketsApiError("Creator names unavailable.", response.status);
  }
  return (await response.json()) as BasenamesResponse;
}

function uniqueCoins(pages?: MarketResponse[]) {
  const seen = new Set<string>();
  return (pages ?? []).flatMap((page) =>
    page.data.filter((coin) => {
      const address = coin.contract_address.toLowerCase();
      if (seen.has(address)) return false;
      seen.add(address);
      return true;
    })
  );
}

function MarketsSkeleton() {
  return (
    <div aria-label="Loading markets" className="overflow-hidden rounded-2xl border-2 border-[#2d3748] bg-white shadow-[3px_3px_0_#2d3748]">
      <div className="h-11 animate-pulse border-b-2 border-art-gray-200 bg-art-gray-100" />
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="flex h-16 items-center gap-4 border-b border-art-gray-100 px-4 last:border-0">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-art-gray-200" />
          <div className="h-3 w-32 animate-pulse rounded bg-art-gray-200" />
          <div className="ml-auto h-3 w-20 animate-pulse rounded bg-art-gray-200" />
        </div>
      ))}
    </div>
  );
}

type GalleryCardProps = {
  coin: SupabaseCoinSnapshot;
  creatorLabel: string | null;
  eager: boolean;
  isWatchlisted: boolean;
  watchlistBusy: boolean;
  onToggleWatchlist: (coin: SupabaseCoinSnapshot) => void;
};

function galleryAspectClass(address: string) {
  const bucket = Number.parseInt(address.slice(-2), 16) % 3;
  if (bucket === 0) return "aspect-[4/5]";
  if (bucket === 1) return "aspect-square";
  return "aspect-[5/4]";
}

const MarketGalleryCard = memo(function MarketGalleryCard({
  coin,
  creatorLabel,
  eager,
  isWatchlisted,
  watchlistBusy,
  onToggleWatchlist,
}: GalleryCardProps) {
  return (
    <article className="mb-4 inline-block w-full break-inside-avoid overflow-hidden rounded-[18px_10px_20px_12px] border-2 border-[#2d3748] bg-white font-art-sans shadow-[3px_3px_0_#2d3748]">
      <div
        className={`relative overflow-hidden border-b-2 border-[#2d3748] bg-art-gray-50 ${galleryAspectClass(coin.contract_address)}`}
      >
        <Link
          href={`/coin/${coin.contract_address}`}
          className="group block h-full w-full p-2 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[var(--base-blue)] focus-visible:outline-offset-[-4px]"
          aria-label={`View ${coin.name}`}
        >
          <SafeImage
            src={coin.image_url ?? ""}
            alt={coin.name}
            width={720}
            height={720}
            fluid
            lazy={!eager}
            className="h-full w-full rounded-lg object-contain transition-transform duration-300 group-hover:scale-[1.015]"
          />
        </Link>
        <CreationTypeBadge
          creationType={coin.creation_type}
          compact
          className="pointer-events-none absolute left-2.5 top-2.5 z-[1] !bg-[#ffd166]"
        />
        <button
          type="button"
          onClick={() => onToggleWatchlist(coin)}
          disabled={watchlistBusy}
          aria-pressed={isWatchlisted}
          aria-label={`${isWatchlisted ? "Remove" : "Add"} ${coin.name} ${isWatchlisted ? "from" : "to"} watchlist`}
          className={`absolute right-2.5 top-2.5 z-[2] inline-flex h-9 items-center gap-1.5 rounded-lg border-2 border-[#2d3748] px-2.5 text-[11px] font-bold shadow-[1px_1px_0_#2d3748] transition disabled:cursor-wait disabled:opacity-60 ${
            isWatchlisted
              ? "bg-[#ffe6eb] text-[#c5305f]"
              : "bg-white/95 text-art-gray-700 hover:bg-[var(--base-blue-soft)] hover:text-[var(--base-blue-hover)]"
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${isWatchlisted ? "fill-current" : ""}`} aria-hidden="true" />
          {isWatchlisted ? "Saved" : "Watch"}
        </button>
      </div>

      <div className="p-4">
        <div className="min-w-0">
          <div className="min-w-0">
            <Link href={`/coin/${coin.contract_address}`} className="group/title block rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--base-blue)]">
              <h2 className="truncate text-lg font-bold leading-tight tracking-[-0.02em] text-art-gray-900 transition-colors group-hover/title:text-[var(--base-blue)]">
                {coin.name}
              </h2>
              <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-[0.08em] text-art-gray-500">
                ${coin.symbol}
              </p>
            </Link>
          </div>
        </div>

        <p
          className="mt-2 truncate text-xs font-semibold text-art-gray-500"
          title={coin.creator_address ?? undefined}
        >
          {creatorLabel ? `by ${creatorLabel}` : "Creator unavailable"}
        </p>

        <dl className="mt-3 grid grid-cols-3 gap-1.5 text-left">
          <div className="rounded-lg border border-art-gray-200 bg-art-gray-50 px-2.5 py-2">
            <dt className="text-[9px] font-bold uppercase tracking-[0.1em] text-art-gray-400">Market cap</dt>
            <dd className="mt-0.5 truncate text-sm font-bold tracking-[-0.01em] text-art-gray-900">{formatCompactUsd(coin.marketCap)}</dd>
          </div>
          <div className="rounded-lg border border-art-gray-200 bg-art-gray-50 px-2.5 py-2">
            <dt className="text-[9px] font-bold uppercase tracking-[0.1em] text-art-gray-400">Holders</dt>
            <dd className="mt-0.5 truncate text-sm font-bold tracking-[-0.01em] text-art-gray-900">{formatInteger(coin.holders)}</dd>
          </div>
          <div className="rounded-lg border border-art-gray-200 bg-art-gray-50 px-2.5 py-2">
            <dt className="text-[9px] font-bold uppercase tracking-[0.1em] text-art-gray-400">Watches</dt>
            <dd className="mt-0.5 truncate text-sm font-bold tracking-[-0.01em] text-art-gray-900">{formatInteger(coin.watchlist_count)}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
});

const MarketsGallery = memo(function MarketsGallery({
  coins,
  creatorLabels,
  watchlistSet,
  watchlistBusy,
  onToggleWatchlist,
}: {
  coins: SupabaseCoinSnapshot[];
  creatorLabels: Record<string, string | null>;
  watchlistSet: Set<string>;
  watchlistBusy: string | null;
  onToggleWatchlist: (coin: SupabaseCoinSnapshot) => void;
}) {
  return (
    <section
      aria-label="DrawCoin market gallery"
      className="columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4"
    >
      {coins.map((coin, index) => (
        <MarketGalleryCard
          key={coin.contract_address}
          coin={coin}
          creatorLabel={
            creatorLabels[coin.contract_address.toLowerCase()] ?? null
          }
          eager={index < 8}
          isWatchlisted={watchlistSet.has(coin.contract_address.toLowerCase())}
          watchlistBusy={watchlistBusy === coin.contract_address.toLowerCase()}
          onToggleWatchlist={onToggleWatchlist}
        />
      ))}
    </section>
  );
});

export default function MarketsPage() {
  const [sort, setSort] = useState<MarketsSort>("newest");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [view, setView] = useState<MarketsView>("table");
  const [urlReady, setUrlReady] = useState(false);
  const [watchlistBusy, setWatchlistBusy] = useState<string | null>(null);
  const { watchlist, toggleWatchlist } = useWatchlist();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedSort = params.get("sort");
    const requestedView = params.get("view");
    const requestedSearch = (params.get("q") ?? "").slice(0, 100);
    setSort(requestedSort === "market-cap" ? "market-cap" : "newest");
    setView(requestedView === "gallery" ? "gallery" : "table");
    setSearch(requestedSearch);
    setDebouncedSearch(requestedSearch.trim());
    setUrlReady(true);
  }, []);

  const getKey = useCallback(
    (pageIndex: number, previousPage: MarketResponse | null) => {
      if (!urlReady) return null;
      if (previousPage && pageIndex >= previousPage.meta.totalPages) return null;
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(pageIndex + 1),
        sort,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      return `/api/market?${params.toString()}`;
    },
    [debouncedSearch, sort, urlReady]
  );

  const {
    data: pages,
    error,
    isLoading,
    isValidating,
    mutate,
    setSize,
    size,
  } = useSWRInfinite<MarketResponse, MarketsApiError>(getKey, fetchMarkets, {
    persistSize: false,
    revalidateFirstPage: false,
    revalidateOnFocus: false,
    errorRetryCount: 1,
  });

  useEffect(() => {
    if (!urlReady) return;
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      void setSize(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search, setSize, urlReady]);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    if (sort !== "newest") params.set("sort", sort);
    if (view !== "table") params.set("view", view);
    if (search.trim()) params.set("q", search.trim());
    const query = params.toString();
    window.history.replaceState(null, "", `/markets${query ? `?${query}` : ""}`);
  }, [search, sort, urlReady, view]);

  const coins = useMemo(() => uniqueCoins(pages), [pages]);
  const creatorAddressKey = useMemo(
    () =>
      createCreatorAddressBatch(
        coins.map((coin) => coin.creator_address),
        Math.min(MAX_CREATOR_IDENTITY_BATCH, VISIBLE_CREATOR_BATCH_SIZE)
      ).join(","),
    [coins]
  );
  const { data: identityData } = useSWR<BasenamesResponse>(
    creatorAddressKey
      ? `/api/basenames?addresses=${encodeURIComponent(creatorAddressKey)}`
      : null,
    fetchBasenames,
    {
      dedupingInterval: 30 * 60 * 1000,
      errorRetryCount: 0,
      revalidateOnFocus: false,
    }
  );
  const creatorBasenames = identityData?.basenames;
  const creatorLabels = useMemo(() => {
    const labels: Record<string, string | null> = {};
    for (const coin of coins) {
      const creatorAddress = normalizeCreatorAddress(coin.creator_address);
      labels[coin.contract_address.toLowerCase()] = getCreatorDisplayLabel({
        address: creatorAddress,
        persistedName: coin.creator_name,
        resolvedBasename: creatorAddress
          ? creatorBasenames?.[creatorAddress]
          : null,
      });
    }
    return labels;
  }, [coins, creatorBasenames]);
  const watchlistSet = useMemo(
    () => new Set(watchlist.map((address) => address.toLowerCase())),
    [watchlist]
  );

  const handleToggleWatchlist = useCallback(
    async (coin: SupabaseCoinSnapshot) => {
      const normalizedAddress = coin.contract_address.toLowerCase();
      setWatchlistBusy(normalizedAddress);
      try {
        await toggleWatchlist(coin.contract_address, {
          priceUsd: coin.current_price,
        });
      } finally {
        setWatchlistBusy((current) =>
          current === normalizedAddress ? null : current
        );
      }
    },
    [toggleWatchlist]
  );

  const total = pages?.[0]?.meta.total ?? 0;
  const lastPage = pages?.[pages.length - 1];
  const hasMore = Boolean(lastPage && lastPage.meta.page < lastPage.meta.totalPages);
  const loadingMore = isValidating && size > (pages?.length ?? 0);

  const changeSort = (nextSort: MarketsSort) => {
    setSort(nextSort);
    void setSize(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-art-off-white px-3 pb-12 pt-5 sm:px-5 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px]">
        <header className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="font-art-sans text-3xl font-bold tracking-[-0.03em] text-art-gray-900 sm:text-4xl">Markets</h1>
              <span className="rounded-full border border-[var(--base-blue)] bg-[var(--base-blue-soft)] px-2 py-0.5 text-xs font-bold text-[var(--base-blue-hover)]">{total}</span>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-art-gray-600">
              Discover every DrawCoin, from fresh launches to the biggest markets.
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            <label className="relative min-w-0 sm:w-64 xl:w-72">
              <span className="sr-only">Search markets</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-art-gray-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                maxLength={100}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search coin, creator or address"
                className="h-11 w-full rounded-xl border-2 border-[#2d3748] bg-white pl-9 pr-9 text-sm font-semibold outline-none shadow-[2px_2px_0_#2d3748] focus:border-[var(--base-blue)]"
              />
              {search ? (
                <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg hover:bg-art-gray-100">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </label>

            <div className="flex h-11 shrink-0 rounded-xl border-2 border-[#2d3748] bg-white p-0.5 shadow-[2px_2px_0_#2d3748]" role="tablist" aria-label="Market order">
              {([
                ["newest", "New", Clock3],
                ["market-cap", "Market Cap", TrendingUp],
              ] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={sort === value}
                  onClick={() => changeSort(value)}
                  className={`flex min-w-24 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition sm:min-w-28 ${sort === value ? "bg-[var(--base-blue)] text-white" : "text-art-gray-600 hover:bg-[var(--base-blue-soft)]"}`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>

            <div
              className="flex h-11 shrink-0 rounded-xl border-2 border-[#2d3748] bg-white p-0.5 shadow-[2px_2px_0_#2d3748]"
              role="group"
              aria-label="Market view"
            >
              {([
                ["table", "Table", Table2],
                ["gallery", "Gallery", LayoutGrid],
              ] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`Show ${label.toLowerCase()} view`}
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                  className={`flex min-w-20 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition ${
                    view === value
                      ? "bg-art-gray-900 text-white"
                      : "text-art-gray-600 hover:bg-art-gray-100"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {!urlReady || (isLoading && coins.length === 0) ? (
          <MarketsSkeleton />
        ) : error && coins.length === 0 ? (
          <div className="rounded-2xl border-2 border-[#2d3748] bg-amber-50 p-8 text-center shadow-[3px_3px_0_#2d3748]" role="alert">
            <h2 className="font-bold text-art-gray-900">Markets are temporarily unavailable</h2>
            <p className="mt-2 text-sm text-art-gray-600">{error.message}</p>
            <button type="button" onClick={() => void mutate()} className="mt-4 rounded-xl border-2 border-[#2d3748] bg-[var(--base-blue)] px-4 py-2 text-sm font-bold text-white shadow-[2px_2px_0_#2d3748] hover:bg-[var(--base-blue-hover)]">Try again</button>
          </div>
        ) : coins.length === 0 ? (
          <div className="rounded-2xl border-2 border-[#2d3748] bg-white p-10 text-center shadow-[3px_3px_0_#2d3748]">
            <h2 className="font-bold text-art-gray-900">No coins found</h2>
            <p className="mt-1 text-sm text-art-gray-500">Try another search.</p>
          </div>
        ) : (
          <>
            {error ? (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs" role="status">
                <span>Refresh failed. Showing your last loaded results.</span>
                <button type="button" onClick={() => void mutate()} className="font-bold underline">Retry</button>
              </div>
            ) : null}

            {view === "gallery" ? (
              <MarketsGallery
                coins={coins}
                creatorLabels={creatorLabels}
                watchlistSet={watchlistSet}
                watchlistBusy={watchlistBusy}
                onToggleWatchlist={(coin) => void handleToggleWatchlist(coin)}
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border-2 border-[#2d3748] bg-white shadow-[3px_3px_0_#2d3748]">
                <div className="no-scrollbar max-w-full overflow-x-auto" role="region" aria-label="DrawCoin market table" tabIndex={0}>
                  <table className="w-full min-w-[980px] border-collapse text-left">
                  <thead className="sticky top-0 z-10 bg-art-gray-50 text-[10px] font-bold uppercase tracking-[0.12em] text-art-gray-500">
                    <tr className="border-b-2 border-[#2d3748]">
                      <th className="w-12 px-3 py-3 text-center">#</th>
                      <th className="min-w-64 px-3 py-3">Coin</th>
                      <th className="min-w-44 px-3 py-3">Creator</th>
                      <th className="px-3 py-3 text-right">Market cap</th>
                      <th className="px-3 py-3 text-right">24h volume</th>
                      <th className="px-3 py-3 text-right">Holders</th>
                      <th className="px-3 py-3 text-right">Watchlists</th>
                      <th className="px-3 py-3 text-right">Age</th>
                      <th className="w-28 px-3 py-3 text-right">Watchlist</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-art-gray-100">
                    {coins.map((coin, index) => {
                      const creatorAddress = normalizeCreatorAddress(coin.creator_address);
                      const creatorLabel =
                        creatorLabels[coin.contract_address.toLowerCase()];
                      return (
                        <tr key={coin.contract_address} className="group transition-colors hover:bg-[var(--base-blue-soft)]">
                          <td className="px-3 py-2.5 text-center text-xs font-bold text-art-gray-400">{index + 1}</td>
                          <td className="px-3 py-2.5">
                            <Link href={`/coin/${coin.contract_address}`} className="flex min-w-0 items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--base-blue)]">
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border-2 border-[#2d3748] bg-art-gray-50">
                                <SafeImage src={coin.image_url ?? ""} alt={coin.name} width={40} height={40} fluid className="h-full w-full object-cover" />
                              </div>
                              <div className="min-w-0 font-art-sans">
                                <p className="max-w-48 truncate text-sm font-bold text-art-gray-900 group-hover:text-[var(--base-blue)]">{coin.name}</p>
                                <p className="mt-0.5 max-w-40 truncate text-[10px] font-bold uppercase tracking-[0.08em] text-art-gray-500">${coin.symbol}</p>
                              </div>
                            </Link>
                          </td>
                          <td className="px-3 py-2.5">
                            {creatorLabel ? (
                              <span className="block max-w-40 truncate text-xs font-semibold text-art-gray-600" title={creatorAddress ?? undefined}>{creatorLabel}</span>
                            ) : (
                              <span className="text-art-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm font-bold text-art-gray-900">{formatCompactUsd(coin.marketCap)}</td>
                          <td className="px-3 py-2.5 text-right text-xs font-semibold text-art-gray-600">{formatCompactUsd(coin.volume24h)}</td>
                          <td className="px-3 py-2.5 text-right text-xs font-semibold text-art-gray-600">{formatInteger(coin.holders)}</td>
                          <td className="px-3 py-2.5 text-right text-xs font-semibold text-art-gray-600">{formatInteger(coin.watchlist_count)}</td>
                          <td className="px-3 py-2.5 text-right text-xs font-semibold text-art-gray-500" title={coin.created_at ?? undefined}>{formatCoinAge(coin.created_at)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => void handleToggleWatchlist(coin)}
                              disabled={watchlistBusy === coin.contract_address.toLowerCase()}
                              aria-pressed={watchlistSet.has(coin.contract_address.toLowerCase())}
                              aria-label={`${watchlistSet.has(coin.contract_address.toLowerCase()) ? "Remove" : "Add"} ${coin.name} ${watchlistSet.has(coin.contract_address.toLowerCase()) ? "from" : "to"} watchlist`}
                              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border-2 border-[#2d3748] px-2.5 text-xs font-bold shadow-[1px_1px_0_#2d3748] transition disabled:cursor-wait disabled:opacity-60 ${watchlistSet.has(coin.contract_address.toLowerCase()) ? "bg-[#ffe6eb] text-[#c5305f]" : "bg-white text-art-gray-700 hover:bg-[var(--base-blue-soft)] hover:text-[var(--base-blue-hover)]"}`}
                            >
                              <Heart className={`h-3.5 w-3.5 ${watchlistSet.has(coin.contract_address.toLowerCase()) ? "fill-current" : ""}`} aria-hidden="true" />
                              {watchlistSet.has(coin.contract_address.toLowerCase()) ? "Saved" : "Watch"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="py-7 text-center">
              {hasMore ? (
                <button type="button" onClick={() => void setSize((current) => current + 1)} disabled={loadingMore} className="min-h-11 rounded-xl border-2 border-[#2d3748] bg-white px-5 py-2.5 text-sm font-bold shadow-[2px_2px_0_#2d3748] disabled:opacity-60">
                  {loadingMore ? "Loading…" : `Load more · ${coins.length} of ${total}`}
                </button>
              ) : (
                <p className="text-xs font-semibold text-art-gray-500">Showing all {total} markets.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
