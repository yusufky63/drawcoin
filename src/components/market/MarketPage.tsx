import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import useSWR from "swr";
import { Coin } from "../../lib/supabase";
import TokenGrid from "./TokenGrid";
import TokenFilters from "./TokenFilters";
import DetailsModal from "./DetailsModal";
import { useWatchlist } from "../../hooks/useWatchlist";
import HandDrawnSkeleton from "../ui/HandDrawnSkeleton";

interface MarketPageProps {
  onTrade: (token: Coin) => void;
  onView: (token: Coin) => void;
}

// Fetcher function for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function MarketPage({ onView }: MarketPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [creationType, setCreationType] = useState<"all" | "ai" | "hand-drawn">(
    "all"
  );
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Coin | null>(null);
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null); // For Profile View

  // Data State
  const [allTokens, setAllTokens] = useState<Coin[]>([]);
  const [visibleCount, setVisibleCount] = useState(20); // Start with only 20 for faster initial load
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Fetch more tokens for client-side filtering, but render progressively
  // Start with 500 tokens which covers most use cases without overwhelming the API
  const apiUrl = `/api/market?limit=500`;

  const { data, error, isLoading } = useSWR(apiUrl, fetcher, {
    revalidateOnMount: true, // Only fetch on first mount
    keepPreviousData: true, // Keep showing old data while revalidating
  });

  // Update allTokens when data arrives (with safety check)
  useEffect(() => {
    if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
      console.log("✅ Market data loaded:", data.data.length, "tokens");
      setAllTokens(data.data);
    } else if (data && !data.data) {
      console.warn("⚠️ Market API returned no data:", data);
    }
  }, [data]);

  // Client-side Filtering & Sorting
  const filteredTokens = useMemo(() => {
    let tokens = [...allTokens];

    // 1. Filter by Creator (Profile View)
    if (selectedCreator) {
      tokens = tokens.filter(
        (t) =>
          t.creator_address?.toLowerCase() === selectedCreator.toLowerCase()
      );
    }

    // 2. Filter by Search Term
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      tokens = tokens.filter(
        (t) =>
          t.name.toLowerCase().includes(lowerTerm) ||
          t.symbol.toLowerCase().includes(lowerTerm) ||
          t.creator_name?.toLowerCase().includes(lowerTerm) ||
          t.creator_address?.toLowerCase().includes(lowerTerm)
      );
    }

    // 3. Filter by Creation Type
    if (creationType !== "all") {
      tokens = tokens.filter((t) => t.creation_type === creationType);
    }

    // 4. Sort
    tokens.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return (
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
          );
        case "oldest":
          return (
            new Date(a.created_at || 0).getTime() -
            new Date(b.created_at || 0).getTime()
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

    return tokens;
  }, [allTokens, searchTerm, sortBy, creationType, selectedCreator]);

  // Pagination (Visible Subset)
  const visibleTokens = useMemo(() => {
    return filteredTokens.slice(0, visibleCount);
  }, [filteredTokens, visibleCount]);

  const hasMore = visibleTokens.length < filteredTokens.length;

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(20); // Reset to 20 for faster filter response
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [searchTerm, sortBy, creationType, selectedCreator]);

  // Infinite scroll handler - load 20 more at a time
  const loadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount((prev) => prev + 20);
    }
  }, [hasMore]);

  // Intersection observer - trigger earlier with larger rootMargin
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      {
        rootMargin: "400px", // Load 400px before user reaches the sentinel
        threshold: 0.01,
      }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  // Watchlist Stats Fetching (Lazy load for visible tokens)
  const [watchlistStats, setWatchlistStats] = useState<Record<string, number>>(
    {}
  );

  useEffect(() => {
    const fetchStats = async () => {
      if (visibleTokens.length === 0) return;

      // Only fetch for tokens we don't have stats for yet (optimization)
      // Or just fetch for current page to be safe and simple
      const tokensToFetch = visibleTokens.map((t) => t.contract_address);

      try {
        const res = await fetch("/api/market/stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokens: tokensToFetch }),
        });
        const data = await res.json();
        if (data?.data) {
          setWatchlistStats((prev) => ({ ...prev, ...data.data }));
        }
      } catch (err) {
        console.error("Failed to fetch watchlist stats", err);
      }
    };

    // Debounce slightly to avoid too many requests during fast scroll
    const timeout = setTimeout(fetchStats, 500);
    return () => clearTimeout(timeout);
  }, [visibleTokens.length]); // Re-run when more tokens become visible

  // Handlers
  const handleTrade = (token: Coin) => {
    setSelectedToken(token);
    setTradeModalOpen(true);
  };

  const handleCloseTradeModal = () => {
    setTradeModalOpen(false);
    setSelectedToken(null);
  };

  const handleViewDetails = (token: Coin) => {
    onView(token);
  };

  const handleCreatorClick = (creatorAddress: string) => {
    setSelectedCreator(creatorAddress);
    setSearchTerm(""); // Clear search to show all from creator
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearCreatorFilter = () => {
    setSelectedCreator(null);
  };

  // Watchlist Hook
  const { watchlist, toggleWatchlist } = useWatchlist();
  const watchlistSet = useMemo(
    () => new Set(watchlist.map((a) => a.toLowerCase())),
    [watchlist]
  );

  // Error State
  if (error) {
    console.error("❌ Market data fetch error:", error);
  }

  // Loading State - Only show skeleton if NO data and currently loading
  const showLoading = isLoading && allTokens.length === 0;

  if (showLoading) {
    return (
      <div className="min-h-screen bg-art-off-white pt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-4">
          {/* Hand-Drawn Loading Skeleton */}
          <div className="space-y-6 mt-8">
            {/* Header Skeleton */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <HandDrawnSkeleton variant="text" className="w-48 h-8" />
              <HandDrawnSkeleton variant="text" className="w-64 h-10" />
            </div>

            {/* Token Grid Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <HandDrawnSkeleton variant="card" count={8} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-art-off-white pt-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-4">
        {/* Profile Filter Banner */}
        {selectedCreator && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">👤</span>
              <div>
                <p className="text-sm text-blue-600 font-bold">
                  Viewing Profile
                </p>
                <p className="text-xs text-blue-500 font-mono">
                  {selectedCreator}
                </p>
              </div>
            </div>
            <button
              onClick={clearCreatorFilter}
              className="text-sm bg-white border border-blue-200 px-3 py-1 rounded-full hover:bg-blue-100 transition-colors"
            >
              Clear Filter ✕
            </button>
          </div>
        )}

        {/* Filters */}
        <TokenFilters
          selectedCategory=""
          onCategoryChange={() => {}}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          creationType={creationType}
          onCreationTypeChange={setCreationType}
        />

        {/* Results Count */}
        <div className="mb-4 md:mb-6 flex justify-between items-end">
          <p className="text-xs md:text-sm text-art-gray-600">
            {selectedCreator
              ? `Found ${filteredTokens.length} tokens by this creator`
              : `Showing ${visibleTokens.length} of ${filteredTokens.length} tokens`}
            {allTokens.length > 1000 && (
              <span className="ml-2 text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                Large Dataset Loaded ({allTokens.length})
              </span>
            )}
          </p>
        </div>

        {/* Token Grid */}
        <TokenGrid
          tokens={visibleTokens}
          onTrade={handleTrade}
          onView={handleViewDetails}
          loading={false}
          viewMode={viewMode}
          watchlistSet={watchlistSet}
          onToggleWatchlist={toggleWatchlist}
          // Pass stats and handlers
          onCreatorClick={handleCreatorClick}
          watchlistStats={watchlistStats}
        />

        {/* Infinite scroll sentinel */}
        <div
          ref={sentinelRef}
          className="text-center mt-8 md:mt-12 text-art-gray-500 py-8"
        >
          {hasMore
            ? "Scroll down to load more coins"
            : filteredTokens.length > 0
            ? "No more coins to load"
            : "No coins found matching your criteria"}
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
