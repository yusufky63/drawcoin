import React, { useState, useEffect, useRef, useCallback } from "react";
import { Coin } from "../../lib/supabase";
import { CoinService } from "../../services/coinService";
import TokenGrid from "./TokenGrid";
import TokenFilters from "./TokenFilters";
import DetailsModal from "./DetailsModal";
import { getCoinsBatchSDK } from "../../services/sdk/getCoins.js";

interface MarketPageProps {
  onTrade: (token: Coin) => void;
  onView: (token: Coin) => void;
}

export default function MarketPage({ onTrade, onView }: MarketPageProps) {
  const [tokens, setTokens] = useState<Coin[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [marketStats, setMarketStats] = useState({
    totalTokens: 0,
  });
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Coin | null>(null);
  // Infinite scroll state
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const PAGE_SIZE = 20;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const sdkCache = useRef<Map<string, any>>(new Map());

  // Load tokens and categories
  useEffect(() => {
    const loadInitial = async () => {
      try {
        setLoading(true);

        const addrRows = await CoinService.getCoinAddresses({
          limit: PAGE_SIZE,
          offset: 0,
        });
        const augmented = await augmentWithSdk(addrRows);
        setTokens(augmented);
        setFilteredTokens(augmented);
        setPage(1);
        setHasMore(addrRows.length === PAGE_SIZE);

        // Basic stats from first page
        const totalTokens = augmented.length;
        setMarketStats({ totalTokens });
      } catch (error) {
        console.error("Error loading market data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadInitial();
  }, []);

  // Filter and sort tokens
  useEffect(() => {
    let filtered = [...tokens];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (token) =>
          token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          token.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case "oldest":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case "price-high":
          return (
            parseFloat(b.current_price || "0") -
            parseFloat(a.current_price || "0")
          );
        case "price-low":
          return (
            parseFloat(a.current_price || "0") -
            parseFloat(b.current_price || "0")
          );
        case "volume-high":
          return (
            parseFloat(b.volume_24h || "0") - parseFloat(a.volume_24h || "0")
          );
        case "holders-high":
          return (b.holders || 0) - (a.holders || 0);
        default:
          return 0;
      }
    });

    setFilteredTokens(filtered);
  }, [tokens, searchTerm, sortBy]);

  // Load more handler (infinite scroll)
  const loadMore = useCallback(async () => {
    if (fetchingMore || !hasMore) return;
    try {
      setFetchingMore(true);
      const addrRows = await CoinService.getCoinAddresses({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      const next = await augmentWithSdk(addrRows);
      // Deduplicate by id (or contract_address)
      let added = 0;
      setTokens((prev) => {
        const filtered = next.filter(
          (n) =>
            !prev.some((p) =>
              p.id
                ? p.id === (n as any).id
                : p.contract_address === n.contract_address
            )
        );
        added = filtered.length;
        return filtered.length ? [...prev, ...filtered] : prev;
      });
      setFilteredTokens((prev) => {
        // Keep same dedupe rule for filtered array
        const filtered = next.filter(
          (n) =>
            !prev.some((p) =>
              p.id
                ? p.id === (n as any).id
                : p.contract_address === n.contract_address
            )
        );
        return filtered.length ? [...prev, ...filtered] : prev;
      });
      setPage((prev) => prev + 1);
      // Stop if no new unique items were added
      if (added === 0) {
        setHasMore(false);
      } else {
        setHasMore(addrRows.length === PAGE_SIZE);
      }
    } catch (e) {
      console.error("Error loading more tokens:", e);
    } finally {
      setFetchingMore(false);
    }
  }, [fetchingMore, hasMore, page, searchTerm]);

  // Intersection observer for sentinel
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  // Refetch when filters change (reset pagination)
  useEffect(() => {
    const refetch = async () => {
      try {
        setLoading(true);
        setPage(0);
        setHasMore(true);
        const addrRows = await CoinService.getCoinAddresses({
          limit: PAGE_SIZE,
          offset: 0,
        });
        const augmented = await augmentWithSdk(addrRows);
        setTokens(augmented);
        setFilteredTokens(augmented);
        setPage(1);
        setHasMore(addrRows.length === PAGE_SIZE);
      } catch (e) {
        console.error("Error refetching tokens:", e);
      } finally {
        setLoading(false);
      }
    };
    if (page > 0) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Map Supabase addresses to SDK token basics (name, symbol, image)
  async function augmentWithSdk(
    rows: Array<{ contract_address: string; created_at: string }>
  ): Promise<Coin[]> {
    const out: Coin[] = [] as any;
    const limit = 3;
    // Build address list and consult cache first
    const needFetch: string[] = [];
    const normalized = rows.map((r) => ({
      row: r,
      addr: (r.contract_address || "").toLowerCase(),
    }));
    for (const n of normalized) {
      if (!n.addr) continue;
      if (!sdkCache.current.has(n.addr)) needFetch.push(n.addr);
    }
    // Batch fetch missing via SDK (up to 20 coins at once)
    if (needFetch.length) {
      const batch = await getCoinsBatchSDK(needFetch, 8453);
      Object.entries(batch).forEach(([addr, data]) =>
        sdkCache.current.set(addr, data)
      );
    }
    // Compose output in original order
    for (const n of normalized) {
      if (!n.addr) continue;
      const sdk: any = sdkCache.current.get(n.addr) || {};
      // Prefer preview image from mediaContent or avatar; fallback to tokenUri (ipfs)
      const toHttp = (uri?: string) =>
        uri && uri.startsWith("ipfs://")
          ? `https://ipfs.io/ipfs/${uri.replace("ipfs://", "")}`
          : uri || "";
      const image =
        sdk?.mediaContent?.previewImage?.medium ||
        sdk?.mediaContent?.previewImage?.small ||
        sdk?.creatorProfile?.avatar?.medium ||
        sdk?.creatorProfile?.avatar?.small ||
        toHttp(sdk?.tokenUri) ||
        "";
      const name = sdk?.name || "";
      const symbol = sdk?.symbol || "";
      const creatorHandle = sdk?.creatorProfile?.handle || "";
      const holders =
        typeof sdk?.uniqueHolders === "number"
          ? sdk.uniqueHolders
          : parseInt(sdk?.uniqueHolders || "0", 10) || 0;
      const volume24h = sdk?.volume24h ?? sdk?.totalVolume ?? "0";
      const marketCap = sdk?.marketCap ?? undefined;
      const change24hRaw = sdk?.marketCapDelta24h ?? undefined;
      const totalSupply = sdk?.totalSupply ?? undefined;
      const currentPrice = sdk?.tokenPrice?.priceInPoolToken ?? undefined;
      const currencyName = sdk?.poolCurrencyToken?.name || "ETH";
      const createdAt = sdk?.createdAt || n.row.created_at;

      const token: any = {
        id: n.row.contract_address,
        name,
        symbol,
        description: sdk?.description || "",
        contract_address: n.row.contract_address,
        image_url: image,
        category: undefined,
        creator_address: sdk?.creatorAddress || "",
        creator_name: creatorHandle || undefined,
        tx_hash: "",
        chain_id: sdk?.chainId || 8453,
        currency: currencyName,
        total_supply: totalSupply,
        current_price: currentPrice,
        volume_24h:
          typeof volume24h === "string" ? volume24h : String(volume24h ?? "0"),
        holders: holders,
        created_at: createdAt,
        updated_at: createdAt,
        // Zora API verilerini doğrudan ekle
        ...sdk,
      };
      (token as any).marketCap =
        typeof marketCap === "string" ? parseFloat(marketCap) : marketCap;
      if (
        change24hRaw !== undefined &&
        change24hRaw !== null &&
        !Number.isNaN(Number(change24hRaw))
      ) {
        (token as any).change24hPct = Number(change24hRaw);
      }

      // Price değişimi hesapla (market cap değişiminden)
      if (
        change24hRaw !== undefined &&
        change24hRaw !== null &&
        !Number.isNaN(Number(change24hRaw)) &&
        marketCap !== undefined &&
        marketCap !== null &&
        !Number.isNaN(Number(marketCap))
      ) {
        const deltaValue = Number(change24hRaw);
        const currentMC = Number(marketCap);

        // Eğer delta, market cap ile aynıysa (yeni token), "NEW" göster
        if (deltaValue === currentMC) {
          (token as any).isNew = true;
          (token as any).priceChange24h = null; // Yeni tokenlarda price change gösterme
        } else {
          // Normal hesaplama: (delta / (currentMC - delta)) * 100
          const previousMC = currentMC - deltaValue;
          if (previousMC > 0) {
            const priceChange = (deltaValue / previousMC) * 100;
            (token as any).priceChange24h = priceChange;
          } else {
            (token as any).priceChange24h = null;
          }
        }
      } else {
        (token as any).priceChange24h = null;
      }
      out.push(token);
    }
    return out;
  }

  const handleTrade = (token: Coin) => {
    setSelectedToken(token);
    setTradeModalOpen(true);
  };

  const handleCloseTradeModal = () => {
    setTradeModalOpen(false);
    setSelectedToken(null);
  };

  const handleViewDetails = (token: Coin) => {
    // Navigate to coin detail page instead of opening modal
    window.location.href = `/coin/${token.contract_address}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-art-off-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-4">
          {/* Loading Skeleton */}
          <div className="space-y-6">
            {/* Header Skeleton */}
            <div className="mb-4">
              <div className="h-8 bg-art-gray-200 rounded animate-pulse w-1/3 mb-4"></div>
              <div className="flex items-center space-x-4">
                <div className="h-6 bg-art-gray-200 rounded animate-pulse w-24"></div>
                <div className="h-6 bg-art-gray-200 rounded animate-pulse w-24"></div>
              </div>
            </div>

            {/* Filters Skeleton */}
            <div className="flex items-center space-x-4">
              <div className="h-10 bg-art-gray-200 rounded animate-pulse w-48"></div>
              <div className="h-10 bg-art-gray-200 rounded animate-pulse w-32"></div>
              <div className="h-10 bg-art-gray-200 rounded animate-pulse w-20"></div>
            </div>

            {/* Results Count Skeleton */}
            <div className="h-4 bg-art-gray-200 rounded animate-pulse w-48"></div>

            {/* Token Grid Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="hand-drawn-card">
                  <div
                    className="aspect-square bg-art-gray-200 rounded-art-lg mb-3 animate-pulse"
                    style={{ borderRadius: "20px 10px 25px 15px" }}
                  ></div>
                  <div className="space-y-2">
                    <div className="h-5 bg-art-gray-200 rounded animate-pulse w-3/4"></div>
                    <div className="h-4 bg-art-gray-200 rounded animate-pulse w-1/2"></div>
                    <div className="flex justify-between">
                      <div className="h-6 bg-art-gray-200 rounded animate-pulse w-1/3"></div>
                      <div className="h-4 bg-art-gray-200 rounded animate-pulse w-1/4"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-art-off-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-4">
        {/* Page Header with Stats */}
        <div className="mb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
            {/* Inline Market Stats */}
            <div className="flex items-center space-x-4 mt-4 md:mt-0"></div>
          </div>
        </div>

        {/* Filters */}
        <TokenFilters
          categories={[]}
          selectedCategory=""
          onCategoryChange={() => {}}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Results Count */}
        <div className="mb-4 md:mb-6">
          <p className="text-xs md:text-sm text-art-gray-600">
            Showing {filteredTokens.length} of {tokens.length} tokens
          </p>
        </div>

        {/* Token Grid */}
        <TokenGrid
          tokens={filteredTokens}
          onTrade={handleTrade}
          onView={handleViewDetails}
          loading={loading}
          viewMode={viewMode}
        />

        {/* Infinite scroll sentinel */}
        <div
          ref={sentinelRef}
          className="text-center mt-8 md:mt-12 text-art-gray-500"
        >
          {loading
            ? ""
            : fetchingMore
            ? "Loading more…"
            : hasMore
            ? " "
            : "End of list"}
        </div>
      </div>

      {/* Trade Modal */}
      <DetailsModal
        token={selectedToken}
        isOpen={tradeModalOpen}
        onClose={handleCloseTradeModal}
      />
    </div>
  );
}
