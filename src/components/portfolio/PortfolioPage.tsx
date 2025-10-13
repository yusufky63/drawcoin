import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAccount } from 'wagmi';
import { Coin } from '../../lib/supabase';
import { CoinService } from '../../services/coinService';
import { 
  getUserProfile, 
  getUserBalances, 
  getUserCreatedCoins, 
  calculatePortfolioStats,
  transformZoraCoinToCoin 
} from '../../services/portfolioService';
import { getCoinsBatchSDK } from '../../services/sdk/getCoins.js';
import TokenGrid from '../market/TokenGrid';
import DetailsModal from '../market/DetailsModal';
import TokenFilters from '../market/TokenFilters';

interface PortfolioPageProps {
  onView?: (token: Coin) => void;
}

export default function PortfolioPage({ onView }: PortfolioPageProps) {
  const { address, isConnected } = useAccount();
  const [heldTokens, setHeldTokens] = useState<Coin[]>([]);
  const [createdTokens, setCreatedTokens] = useState<Coin[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [portfolioStats, setPortfolioStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'held' | 'created'>('held');
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Coin | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsToken, setDetailsToken] = useState<Coin | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('price-high');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Performance optimization states
  const [platformFilter, setPlatformFilter] = useState<'all' | 'platform'>('platform');
  
  // Debug: Log platform filter changes
  useEffect(() => {
    console.log(`🎯 Platform filter changed to: ${platformFilter}`);
  }, [platformFilter]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 20;
  
  // Cache for Zora API data
  const sdkCache = useRef<Map<string, any>>(new Map());

  // Optimized function to filter platform coins from Supabase first
  const filterPlatformCoins = useCallback(async (zoraCoins: any[], isCreatedCoins = false) => {
    // Get contract addresses from Zora coins
    const contractAddresses = zoraCoins.map(coin => coin.address || coin.contract_address).filter(Boolean);
    
    if (contractAddresses.length === 0) return [];
    
    try {
      // Check which coins exist in our platform database
      const platformCoins = await CoinService.getCoins({
        limit: 1000, // Get all platform coins
        offset: 0
      });
      
      const platformAddresses = new Set(platformCoins.map(coin => coin.contract_address.toLowerCase()));
      
      // Filter Zora coins to only include platform coins
      return zoraCoins.filter(coin => {
        const address = (coin.address || coin.contract_address || '').toLowerCase();
        return platformAddresses.has(address);
      });
    } catch (error) {
      console.error('Error filtering platform coins:', error);
      // Fallback: Show a warning but continue with all coins
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Platform filtering failed, showing all coins. Error:', errorMessage);
      return zoraCoins; // Fallback to all coins if filtering fails
    }
  }, []);

  // Optimized function to augment coins with Zora SDK data
  const augmentWithSdk = useCallback(async (coins: any[]): Promise<Coin[]> => {
    if (coins.length === 0) return [];
    
    const out: Coin[] = [];
    const needFetch: string[] = [];
    
    // Build address list and consult cache first
    const normalized = coins.map(coin => ({ 
      coin, 
      addr: (coin.address || coin.contract_address || '').toLowerCase() 
    }));
    
    for (const n of normalized) {
      if (!n.addr) continue;
      if (!sdkCache.current.has(n.addr)) needFetch.push(n.addr);
    }
    
    // Batch fetch missing via SDK (up to 20 coins at once)
    if (needFetch.length) {
      try {
        const batch = await getCoinsBatchSDK(needFetch, 8453);
        Object.entries(batch).forEach(([addr, data]) => sdkCache.current.set(addr, data));
      } catch (error) {
        console.error('Error fetching SDK data:', error);
        // Continue with existing data if SDK fetch fails
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn('SDK data fetch failed, using available data. Error:', errorMessage);
      }
    }
    
    // Compose output in original order
    for (const n of normalized) {
      if (!n.addr) continue;
      const sdk: any = sdkCache.current.get(n.addr) || {};
      
      try {
        // Transform to our Coin format
        const transformedCoin = transformZoraCoinToCoin({
          ...n.coin,
          ...sdk // Override with SDK data if available
        });
        
        out.push(transformedCoin as Coin);
      } catch (error) {
        console.error('Error transforming coin data:', error);
        // Fallback: create basic coin data
        const fallbackCoin: Coin = {
          id: n.coin.id || n.coin.address || '',
          name: n.coin.name || 'Unknown Token',
          symbol: n.coin.symbol || 'UNK',
          description: n.coin.description || '',
          contract_address: n.coin.address || '',
          image_url: n.coin.mediaContent?.previewImage?.small || '',
          category: 'Unknown',
          creator_address: n.coin.creatorAddress || '',
          creator_name: n.coin.creatorProfile?.handle || '',
          tx_hash: '',
          chain_id: 8453,
          currency: 'ETH',
          total_supply: '0',
          current_price: '0',
          volume_24h: '0',
          holders: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        out.push(fallbackCoin);
      }
    }
    
    return out;
  }, []);

  // Memoized filtered tokens for performance
  const filteredTokens = useMemo(() => {
    const currentTokens = activeTab === 'held' ? heldTokens : createdTokens;
    let filtered = [...currentTokens];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(token =>
        token.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        token.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        token.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
        break;
      case 'price-high':
        filtered.sort((a, b) => (b.current_price ? parseFloat(b.current_price) : 0) - (a.current_price ? parseFloat(a.current_price) : 0));
        break;
      case 'price-low':
        filtered.sort((a, b) => (a.current_price ? parseFloat(a.current_price) : 0) - (b.current_price ? parseFloat(b.current_price) : 0));
        break;
      case 'volume-high':
        filtered.sort((a, b) => (b.volume_24h ? parseFloat(b.volume_24h) : 0) - (a.volume_24h ? parseFloat(a.volume_24h) : 0));
        break;
      case 'holders-high':
        filtered.sort((a, b) => (b.holders || 0) - (a.holders || 0));
        break;
    }

    return filtered;
  }, [heldTokens, createdTokens, activeTab, searchTerm, sortBy]);

  // Optimized portfolio loading with platform filtering
  const loadPortfolio = useCallback(async (page = 0, append = false) => {
    if (!isConnected || !address) {
      setLoading(false);
      return;
    }

    try {
      if (!append) setLoading(true);
      else setIsLoadingMore(true);
      
      // Load user profile first (only once)
      if (page === 0) {
        const profile = await getUserProfile(address).catch(err => {
          console.warn('Could not fetch user profile:', err);
          return null;
        });
        setUserProfile(profile);
      }
      
      // Load tokens with pagination
      const [balancesResult, createdCoinsResult] = await Promise.all([
        getUserBalances(address, PAGE_SIZE).catch(err => {
          console.warn('Could not fetch user balances:', err);
          return { balances: [], hasMore: false, nextCursor: null };
        }),
        getUserCreatedCoins(address, PAGE_SIZE).catch(err => {
          console.warn('Could not fetch created coins:', err);
          return { coins: [], hasMore: false, nextCursor: null };
        })
      ]);

      const balances = balancesResult.balances || [];
      const createdCoins = createdCoinsResult.coins || [];

      // Filter platform coins first (performance optimization)
      let filteredBalances, filteredCreatedCoins;
      
      if (platformFilter === 'all') {
        // Show all Zora coins without filtering
        console.log('🔍 Showing ALL Zora coins (no filtering)');
        filteredBalances = balances;
        filteredCreatedCoins = createdCoins;
      } else {
        // Filter to show only platform coins
        console.log('🔍 Filtering to show only platform coins');
        const [filteredBalancesResult, filteredCreatedCoinsResult] = await Promise.all([
          filterPlatformCoins(balances),
          filterPlatformCoins(createdCoins, true)
        ]);
        filteredBalances = filteredBalancesResult;
        filteredCreatedCoins = filteredCreatedCoinsResult;
      }
      
      console.log(`📊 Filter results: ${filteredBalances.length} held tokens, ${filteredCreatedCoins.length} created tokens`);

      // Augment with SDK data in batches
      const [augmentedHeldTokens, augmentedCreatedTokens] = await Promise.all([
        augmentWithSdk(filteredBalances),
        augmentWithSdk(filteredCreatedCoins)
      ]);

      // Calculate portfolio statistics
      const stats = calculatePortfolioStats(filteredBalances, filteredCreatedCoins);

      if (append) {
        // Append to existing data for pagination
        setHeldTokens(prev => [...prev, ...augmentedHeldTokens]);
        setCreatedTokens(prev => [...prev, ...augmentedCreatedTokens]);
        setIsLoadingMore(false);
      } else {
        // Initial load
        setHeldTokens(augmentedHeldTokens as Coin[]);
        setCreatedTokens(augmentedCreatedTokens as Coin[]);
        setPortfolioStats(stats);
        setLoading(false);
      }
      
      // Check if there's more data
      setHasMoreData(balancesResult.hasMore || createdCoinsResult.hasMore);
      setCurrentPage(page);
      
    } catch (error) {
      console.error('Error loading portfolio:', error);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        console.warn('Rate limited by Zora API, will retry automatically');
        // Could add a toast notification here
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        console.warn('Network error, please check your connection');
        // Could add a toast notification here
      }
      
      setLoading(false);
      setIsLoadingMore(false);
      
      // Don't throw the error to prevent app crashes
      // The UI will show empty state gracefully
    }
  }, [isConnected, address, filterPlatformCoins, augmentWithSdk]);

  // Load more data for pagination
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMoreData) return;
    await loadPortfolio(currentPage + 1, true);
  }, [loadPortfolio, currentPage, isLoadingMore, hasMoreData]);

  // Initial load
  useEffect(() => {
    if (isConnected && address) {
      loadPortfolio(0, false);
    }
  }, [isConnected, address]);

  // Reset when platform filter changes
  useEffect(() => {
    if (isConnected && address) {
      setCurrentPage(0);
      setHasMoreData(true);
      setHeldTokens([]);
      setCreatedTokens([]);
      loadPortfolio(0, false);
    }
  }, [platformFilter]);

  const handleTrade = (token: Coin) => {
    setSelectedToken(token);
    setTradeModalOpen(true);
  };

  const handleCloseTradeModal = () => {
    setTradeModalOpen(false);
    setSelectedToken(null);
  };

  const handleViewDetails = (token: Coin) => {
    if (onView) {
      onView(token);
    } else {
      // Navigate to coin detail page
      window.location.href = `/coin/${token.contract_address}`;
    }
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setDetailsToken(null);
  };

  const handleTradeFromDetails = (token: Coin) => {
    setSelectedToken(token);
    setTradeModalOpen(true);
    setDetailsOpen(false);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-art-off-white flex items-center justify-center">
        <div className="text-center hand-drawn-card" style={{ maxWidth: '400px' }}>
          <div className="mx-auto w-24 h-24 hand-drawn-icon-wrapper mb-4 transform rotate-1">
            <svg className="w-12 h-12 text-art-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ strokeWidth: 2 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl  font-bold text-art-gray-900 mb-2 transform -rotate-1">Connect Your Wallet</h2>
          <p className="text-art-gray-600 ">Please connect your wallet to view your hand-drawn art portfolio.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-art-off-white">
        <div className="max-w-7xl mx-auto p-4">
          {/* Loading Skeleton */}
          <div className="space-y-6">
            {/* Profile Card Skeleton */}
            <div className="hand-drawn-card">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-art-gray-200 rounded-full animate-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-6 bg-art-gray-200 rounded animate-pulse w-1/3"></div>
                  <div className="h-4 bg-art-gray-200 rounded animate-pulse w-1/2"></div>
                </div>
              </div>
            </div>

            {/* Stats Skeleton */}
            <div className="hand-drawn-card">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="text-center bg-art-off-white p-3 rounded-art" style={{ borderRadius: '15px 5px 10px 8px' }}>
                    <div className="h-8 bg-art-gray-200 rounded animate-pulse mb-2"></div>
                    <div className="h-4 bg-art-gray-200 rounded animate-pulse w-3/4 mx-auto"></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs Skeleton */}
            <div className="flex space-x-4">
              <div className="h-10 bg-art-gray-200 rounded animate-pulse w-24"></div>
              <div className="h-10 bg-art-gray-200 rounded animate-pulse w-24"></div>
            </div>

            {/* Token Grid Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="hand-drawn-card">
                  <div className="aspect-square bg-art-gray-200 rounded-art-lg mb-3 animate-pulse" style={{ borderRadius: '20px 10px 25px 15px' }}></div>
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
      <div className="max-w-7xl mx-auto p-4 ">
        {/* Page Header with Profile Info */}
        <div className="mb-2">
       
          {/* Profile Card */}
          {userProfile && (
            <div className="hand-drawn-card mt-4">
              <div className="flex items-center space-x-4">
                {userProfile.avatar?.medium && (
                  <img 
                    src={userProfile.avatar.medium} 
                    alt="Profile" 
                    className="w-16 h-16 rounded-full border-2 border-art-gray-200"
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-art-gray-900">
                    {userProfile.displayName || userProfile.handle || 'Anonymous'}
                  </h3>
                  {userProfile.handle && (
                    <p className="text-sm text-art-gray-600">@{userProfile.handle}</p>
                  )}
                  {userProfile.website && (
                    <a 
                      href={userProfile.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {userProfile.website}
                    </a>
                  )}
                </div>
                {userProfile.creatorCoin && (
                  <div className="text-right">
                    <p className="text-sm text-art-gray-600">Creator Coin</p>
                    <p className="text-lg font-semibold text-art-gray-900">
                      {userProfile.creatorCoin.marketCap ? 
                        `$${parseFloat(userProfile.creatorCoin.marketCap).toLocaleString()}` : 
                        'N/A'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Portfolio Stats */}
        {portfolioStats && (
          <div className="hand-drawn-card mb-6 md:mb-8">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
              <div className="text-center bg-art-off-white p-3 rounded-art transform rotate-1" style={{ borderRadius: '15px 5px 10px 8px' }}>
                <div className="text-lg md:text-2xl font-bold text-art-gray-900 mb-1">
                  {portfolioStats.totalHoldings}
                </div>
                <div className="text-xs md:text-sm text-art-gray-500">Tokens Held</div>
              </div>
              <div className="text-center bg-art-off-white p-3 rounded-art transform -rotate-1" style={{ borderRadius: '10px 8px 15px 5px' }}>
                <div className="text-lg md:text-2xl font-bold text-art-gray-900 mb-1">
                  {portfolioStats.totalCreated}
                </div>
                <div className="text-xs md:text-sm text-art-gray-500">Tokens Created</div>
              </div>
              <div className="text-center bg-art-off-white p-3 rounded-art transform -rotate-0.5" style={{ borderRadius: '8px 12px 6px 15px' }}>
                <div className="text-lg md:text-2xl font-bold text-art-gray-900 mb-1">
                  {portfolioStats.totalHolders}
                </div>
                <div className="text-xs md:text-sm text-art-gray-500">Total Holders</div>
              </div>
            </div>
          </div>
        )}

        {/* Platform Filter */}
        <div className="mb-4">
          <div className="hand-drawn-card">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-art-gray-700">Filter by Platform</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    console.log('🔄 Switching to Platform filter');
                    setPlatformFilter('platform');
                  }}
                  className={`px-3 py-1 text-xs font-medium transition-all duration-200 ${
                    platformFilter === 'platform'
                      ? 'bg-art-gray-900 text-art-white'
                      : 'bg-art-gray-100 text-art-gray-700 hover:bg-art-gray-200'
                  }`}
                  style={{ 
                    borderRadius: '8px 3px 6px 4px',
                    border: '1px solid #2d3748',
                    transform: platformFilter === 'platform' ? 'rotate(-0.5deg)' : 'rotate(0.5deg)'
                  }}
                >
                  Our Platform
                </button>
                <button
                  onClick={() => {
                    console.log('🔄 Switching to All Zora filter');
                    setPlatformFilter('all');
                  }}
                  className={`px-3 py-1 text-xs font-medium transition-all duration-200 ${
                    platformFilter === 'all'
                      ? 'bg-art-gray-900 text-art-white'
                      : 'bg-art-gray-100 text-art-gray-700 hover:bg-art-gray-200'
                  }`}
                  style={{ 
                    borderRadius: '6px 4px 8px 3px',
                    border: '1px solid #2d3748',
                    transform: platformFilter === 'all' ? 'rotate(0.5deg)' : 'rotate(-0.5deg)'
                  }}
                >
                  All Zora
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="hand-drawn-card">
            <div className="flex space-x-2 p-2">
              <button
                onClick={() => setActiveTab('held')}
                className={`flex-1 py-3 px-4 text-sm font-bold transition-all duration-200 ${
                  activeTab === 'held'
                    ? 'bg-art-gray-900 text-art-white shadow-sm'
                    : 'bg-art-gray-100 text-art-gray-700 hover:bg-art-gray-200'
                }`}
                style={{ 
                  borderRadius: activeTab === 'held' ? '15px 5px 10px 8px' : '12px 3px 8px 6px',
                  transform: activeTab === 'held' ? 'rotate(-1deg)' : 'rotate(0.5deg)',
                  border: '2px solid #2d3748',
                  boxShadow: activeTab === 'held' ? '3px 3px 0 #2d3748' : '2px 2px 0 #2d3748'
                }}
              >
                Held Tokens ({heldTokens.length})
              </button>
              <button
                onClick={() => setActiveTab('created')}
                className={`flex-1 py-3 px-4 text-sm font-bold transition-all duration-200 ${
                  activeTab === 'created'
                    ? 'bg-art-gray-900 text-art-white shadow-sm'
                    : 'bg-art-gray-100 text-art-gray-700 hover:bg-art-gray-200'
                }`}
                style={{ 
                  borderRadius: activeTab === 'created' ? '10px 8px 15px 5px' : '8px 12px 6px 10px',
                  transform: activeTab === 'created' ? 'rotate(1deg)' : 'rotate(-0.5deg)',
                  border: '2px solid #2d3748',
                  boxShadow: activeTab === 'created' ? '3px 3px 0 #2d3748' : '2px 2px 0 #2d3748'
                }}
              >
                Created Tokens ({createdTokens.length})
              </button>
            </div>
          </div>
        </div>

        {/* Tokens Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="bg-art-white rounded-art-lg shadow-art p-3 md:p-6 border border-art-gray-100 animate-pulse">
                <div className="aspect-square bg-art-gray-200 rounded-art-lg mb-3 md:mb-4"></div>
                <div className="space-y-2 md:space-y-3">
                  <div className="h-4 md:h-5 bg-art-gray-200 rounded w-3/4"></div>
                  <div className="h-3 md:h-4 bg-art-gray-200 rounded w-1/2"></div>
                  <div className="flex justify-between">
                    <div className="h-5 md:h-6 bg-art-gray-200 rounded w-1/3"></div>
                    <div className="h-3 md:h-4 bg-art-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {activeTab === 'held' ? (
              heldTokens.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto w-24 h-24 bg-art-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-12 h-12 text-art-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-art-gray-900 mb-2">No tokens held yet</h3>
                  <p className="text-art-gray-500 mb-4">Start trading to build your collection of hand-drawn art tokens.</p>
                  <button 
                    onClick={() => window.location.href = '/market'}
                    className="bg-art-gray-900 text-art-white px-6 py-3 rounded-art font-medium hover:bg-art-gray-800 transition-colors"
                  >
                    Browse Market
                  </button>
                </div>
              ) : (
                <>
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
                  <TokenGrid
                    tokens={filteredTokens}
                    onTrade={handleTrade}
                    onView={handleViewDetails}
                    loading={false}
                    viewMode={viewMode}
                  />
                  
                  {/* Load More Button */}
                  {hasMoreData && (
                    <div className="text-center mt-6">
                      <button
                        onClick={loadMore}
                        disabled={isLoadingMore}
                        className="hand-drawn-btn secondary"
                      >
                        {isLoadingMore ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                            Loading more...
                          </div>
                        ) : (
                          'Load More Tokens'
                        )}
                      </button>
                    </div>
                  )}
                </>
              )
            ) : (
              createdTokens.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto w-24 h-24 bg-art-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-12 h-12 text-art-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-art-gray-900 mb-2">No tokens created yet</h3>
                  <p className="text-art-gray-500 mb-4">Start creating your first art token to see it here.</p>
                  <button 
                    onClick={() => window.location.href = '/create'}
                    className="bg-art-gray-900 text-art-white px-6 py-3 rounded-art font-medium hover:bg-art-gray-800 transition-colors"
                  >
                    Create Your First Token
                  </button>
                </div>
              ) : (
                <>
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
                  <TokenGrid
                    tokens={filteredTokens}
                    onTrade={handleTrade}
                    onView={handleViewDetails}
                    loading={false}
                    viewMode={viewMode}
                  />
                  
                  {/* Load More Button */}
                  {hasMoreData && (
                    <div className="text-center mt-6">
                      <button
                        onClick={loadMore}
                        disabled={isLoadingMore}
                        className="hand-drawn-btn secondary"
                      >
                        {isLoadingMore ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                            Loading more...
                          </div>
                        ) : (
                          'Load More Tokens'
                        )}
                      </button>
                    </div>
                  )}
                </>
              )
            )}
          </>
        )}
      </div>

      {/* Trade Modal */}
      <DetailsModal
        token={selectedToken}
        isOpen={tradeModalOpen}
        onClose={handleCloseTradeModal}
      />

      {/* Details Modal */}
      <DetailsModal
        token={detailsToken}
        isOpen={detailsOpen}
        onClose={handleCloseDetails}
        onTrade={handleTradeFromDetails}
      />
    </div>
  );
}
