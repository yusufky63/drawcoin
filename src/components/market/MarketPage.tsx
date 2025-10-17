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
  const [allAddresses, setAllAddresses] = useState<string[]>([]); // Tüm Supabase adresleri
  const [loadedAddresses, setLoadedAddresses] = useState<Set<string>>(new Set()); // Yüklenen adresler
  const INITIAL_LOAD_SIZE = 40; // İlk yükleme
  const PAGE_SIZE = 20; // Sonraki yüklemeler
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const sdkCache = useRef<Map<string, any>>(new Map());

  // Load initial data and all addresses
  const loadInitial = useCallback(async () => {
      try {
        setLoading(true);

        // Get ALL contract addresses from Supabase (for search functionality)
        const addrRows = await CoinService.getCoinAddresses({
          limit: 1000, // Get all addresses
          offset: 0,
        });
        
        const allContractAddresses = addrRows.map(row => row.contract_address);
        setAllAddresses(allContractAddresses);
        
        // Load only first 40 coins initially
        const initialAddresses = allContractAddresses.slice(0, INITIAL_LOAD_SIZE);
        const initialCoins = await loadCoinsFromAddresses(initialAddresses);
        
        console.log(`✅ Market: Loaded ${initialCoins.length} initial coins from ${allContractAddresses.length} total addresses`);
        
        setTokens(initialCoins);
        setFilteredTokens(initialCoins);
        setPage(1);
        setHasMore(allContractAddresses.length > INITIAL_LOAD_SIZE);
        
        // Track loaded addresses
        const newLoadedAddresses = new Set(initialAddresses);
        setLoadedAddresses(newLoadedAddresses);

        // Basic stats
        setMarketStats({ totalTokens: allContractAddresses.length });
      } catch (error) {
        console.error("Error loading market data:", error);
      } finally {
        setLoading(false);
      }
    }, []); // Empty dependency array since this function doesn't depend on any props/state

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Helper function to load coins from addresses
  const loadCoinsFromAddresses = useCallback(async (addresses: string[]): Promise<Coin[]> => {
    const allCoins: Coin[] = [];
    const batchSize = 20;
    
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      console.log(`📦 Market: Fetching batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(addresses.length/batchSize)}: ${batch.length} coins`);
      
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
    
    return allCoins;
  }, []); // Empty dependency array since this function doesn't depend on any props/state

  // Search functionality - search in all Supabase data
  const searchInAllCoins = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      // If no search query, show currently loaded tokens
      setFilteredTokens(tokens);
      return;
    }

    try {
      // Search in all Supabase addresses (not just loaded ones)
      const searchResults = await CoinService.getCoinAddresses({
        search: searchQuery,
        limit: 1000
      });
      
      const searchAddresses = searchResults.map(row => row.contract_address);
      console.log(`🔍 Search "${searchQuery}": Found ${searchAddresses.length} matching addresses`);
      
      // Find which addresses are already loaded
      const loadedSearchAddresses = searchAddresses.filter(addr => loadedAddresses.has(addr));
      const unloadedSearchAddresses = searchAddresses.filter(addr => !loadedAddresses.has(addr));
      
      console.log(`📊 Search results: ${loadedSearchAddresses.length} already loaded, ${unloadedSearchAddresses.length} need to be loaded`);
      
      // Filter currently loaded tokens by search results
      let filteredLoadedTokens = tokens.filter(token => 
        loadedSearchAddresses.includes(token.contract_address)
      );
      
      // Load unloaded search results (limit to first 20 to avoid too many requests)
      if (unloadedSearchAddresses.length > 0) {
        const addressesToLoad = unloadedSearchAddresses.slice(0, 20);
        const newCoins = await loadCoinsFromAddresses(addressesToLoad);
        
        // Add new coins to filtered results
        filteredLoadedTokens = [...filteredLoadedTokens, ...newCoins];
        
        // Update loaded addresses
        setLoadedAddresses(prev => {
          const newSet = new Set(prev);
          addressesToLoad.forEach(addr => newSet.add(addr));
          return newSet;
        });
        
        // Update tokens state
        setTokens(prev => {
          const existingAddresses = new Set(prev.map(t => t.contract_address));
          const trulyNewCoins = newCoins.filter(coin => !existingAddresses.has(coin.contract_address));
          return [...prev, ...trulyNewCoins];
        });
      }
      
      setFilteredTokens(filteredLoadedTokens);
      
    } catch (error) {
      console.error("Error searching coins:", error);
      // Fallback to client-side search on loaded tokens
      const filtered = tokens.filter(
        (token) =>
          token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTokens(filtered);
    }
  }, [tokens, loadedAddresses, loadCoinsFromAddresses]);

  // Filter and sort tokens
  useEffect(() => {
    if (searchTerm.trim()) {
      // Use search functionality
      searchInAllCoins(searchTerm);
      return;
    }

    // No search - apply sorting to all loaded tokens
    const filtered = [...tokens];

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
  }, [tokens, searchTerm, sortBy, searchInAllCoins]);

  // Load more handler for infinite scroll
  const loadMore = useCallback(async () => {
    if (fetchingMore || !hasMore) return;
    
    try {
      setFetchingMore(true);
      
      // Calculate next batch of addresses to load
      const currentLoadedCount = loadedAddresses.size;
      const nextBatchStart = currentLoadedCount;
      const nextBatchEnd = Math.min(nextBatchStart + PAGE_SIZE, allAddresses.length);
      const nextBatchAddresses = allAddresses.slice(nextBatchStart, nextBatchEnd);
      
      if (nextBatchAddresses.length === 0) {
        setHasMore(false);
        return;
      }
      
      console.log(`📦 Market: Loading more coins (${nextBatchStart}-${nextBatchEnd}) from ${allAddresses.length} total`);
      
      // Load new coins
      const newCoins = await loadCoinsFromAddresses(nextBatchAddresses);
      
      // Update state
      setTokens(prev => [...prev, ...newCoins]);
      setLoadedAddresses(prev => {
        const newSet = new Set(prev);
        nextBatchAddresses.forEach(addr => newSet.add(addr));
        return newSet;
      });
      
      // Check if there are more coins to load
      setHasMore(nextBatchEnd < allAddresses.length);
      
      console.log(`✅ Market: Loaded ${newCoins.length} more coins. Total loaded: ${currentLoadedCount + newCoins.length}/${allAddresses.length}`);
      
    } catch (error) {
      console.error("Error loading more coins:", error);
    } finally {
      setFetchingMore(false);
    }
  }, [fetchingMore, hasMore, loadedAddresses, allAddresses, loadCoinsFromAddresses]);

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
  }, []); // Empty dependency array since this effect doesn't do anything

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
    // Use the onView prop to show coin detail page within the same app
    onView(token);
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
            ? "Loading more coins..."
            : hasMore
            ? "Scroll down to load more coins"
            : searchTerm.trim()
            ? `Found ${filteredTokens.length} results for "${searchTerm}"`
            : `Showing ${filteredTokens.length} of ${marketStats.totalTokens} coins`}
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
