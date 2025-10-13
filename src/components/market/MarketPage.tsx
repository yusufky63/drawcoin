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

  // Load tokens from Supabase addresses + Zora batch
  useEffect(() => {
    const loadInitial = async () => {
      try {
        setLoading(true);

        // Get contract addresses from Supabase
        const addrRows = await CoinService.getCoinAddresses({
          limit: 1000, // Get all addresses
          offset: 0,
        });
        
        const contractAddresses = addrRows.map(row => row.contract_address);
        
        // Get coin details in batches of 20
        const allCoins = [];
        const batchSize = 20;
        
        for (let i = 0; i < contractAddresses.length; i += batchSize) {
          const batch = contractAddresses.slice(i, i + batchSize);
          console.log(`📦 Market: Fetching batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(contractAddresses.length/batchSize)}: ${batch.length} coins`);
          
          const batchData = await getCoinsBatchSDK(batch, 8453);
          
          // Convert batch data to coin objects
          batch.forEach(address => {
            const zoraCoin = batchData[address.toLowerCase()];
            if (zoraCoin) {
              const coin = {
                id: zoraCoin.address || address,
                name: zoraCoin.name || 'Unknown Token',
                symbol: zoraCoin.symbol || 'UNK',
                description: zoraCoin.description || '',
                contract_address: address,
                image_url: zoraCoin.mediaContent?.previewImage?.medium || zoraCoin.mediaContent?.previewImage?.small || '',
                category: 'Unknown',
                creator_address: zoraCoin.creatorAddress || '',
                creator_name: zoraCoin.creatorProfile?.handle || '',
                tx_hash: '',
                chain_id: 8453,
                currency: zoraCoin.poolCurrencyToken?.name || 'ETH',
                total_supply: zoraCoin.totalSupply || '0',
                current_price: zoraCoin.tokenPrice?.priceInPoolToken || '0',
                volume_24h: zoraCoin.volume24h || zoraCoin.totalVolume || '0',
                holders: zoraCoin.uniqueHolders || 0,
                created_at: zoraCoin.createdAt || new Date().toISOString(),
                updated_at: zoraCoin.createdAt || new Date().toISOString(),
                // Additional Zora data
                marketCap: zoraCoin.marketCap,
                change24hPct: zoraCoin.marketCapDelta24h,
                ...zoraCoin
              };
              allCoins.push(coin);
            }
          });
        }
        
        console.log(`✅ Market: Fetched ${allCoins.length} coins from ${contractAddresses.length} addresses`);
        
        setTokens(allCoins);
        setFilteredTokens(allCoins);
        setPage(1);
        setHasMore(false); // We get all coins at once

        // Basic stats
        const totalTokens = allCoins.length;
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

  // Load more handler (disabled since we load all tokens at once)
  const loadMore = useCallback(async () => {
    // No longer needed since we load all tokens at once
    console.log("Load more disabled - all tokens loaded at once");
  }, []);

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

  // Refetch when filters change (disabled since we load all tokens at once)
  useEffect(() => {
    // No longer needed since we load all tokens at once and filter client-side
    console.log("Refetch disabled - filtering is done client-side");
  }, [searchTerm]);

  // Removed augmentWithSdk function - no longer needed

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
