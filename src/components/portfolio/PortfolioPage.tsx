"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import {
  AnalyticsService,
  PortfolioItem,
} from "../../services/analyticsService";
import { getUserProfile } from "../../services/portfolioService";
import { TransactionHistory } from "./TransactionHistory";
import { formatNumber } from "../../utils/format";
import { supabase } from "../../lib/supabase";
import ShareModal from "./ShareModal";
import HandDrawnSkeleton from "../ui/HandDrawnSkeleton";

interface PortfolioPageProps {
  onView?: (token: any) => void;
}

export default function PortfolioPage({ onView }: PortfolioPageProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [userStats, setUserStats] = useState<any>(null);
  const [zoraProfile, setZoraProfile] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [createdTokens, setCreatedTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "portfolio" | "transactions" | "created"
  >("portfolio");
  const [showShareModal, setShowShareModal] = useState(false);

  // Sorting states
  const [portfolioSort, setPortfolioSort] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "balance", direction: "desc" });
  const [createdSort, setCreatedSort] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "holders", direction: "desc" });

  // Sorting functions
  const handlePortfolioSort = (key: string) => {
    setPortfolioSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleCreatedSort = (key: string) => {
    setCreatedSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortedPortfolio = () => {
    const sorted = [...portfolio].sort((a, b) => {
      const tokenA = (a as any).token_details;
      const tokenB = (b as any).token_details;
      let aVal: any, bVal: any;

      switch (portfolioSort.key) {
        case "name":
          aVal = tokenA?.name?.toLowerCase() || "";
          bVal = tokenB?.name?.toLowerCase() || "";
          break;
        case "mc":
          aVal =
            typeof tokenA?.marketCap === "number"
              ? tokenA.marketCap
              : parseFloat(tokenA?.marketCap || "0");
          bVal =
            typeof tokenB?.marketCap === "number"
              ? tokenB.marketCap
              : parseFloat(tokenB?.marketCap || "0");
          break;
        case "volume":
          aVal =
            typeof tokenA?.volume24h === "number"
              ? tokenA.volume24h
              : parseFloat(tokenA?.volume24h || "0");
          bVal =
            typeof tokenB?.volume24h === "number"
              ? tokenB.volume24h
              : parseFloat(tokenB?.volume24h || "0");
          break;
        case "change":
          aVal =
            typeof tokenA?.change24h === "number"
              ? tokenA.change24h
              : parseFloat(tokenA?.change24h || "0");
          bVal =
            typeof tokenB?.change24h === "number"
              ? tokenB.change24h
              : parseFloat(tokenB?.change24h || "0");
          break;
        case "balance":
          aVal = a.balance || 0;
          bVal = b.balance || 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return portfolioSort.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return portfolioSort.direction === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  };

  const getSortedCreatedTokens = () => {
    const sorted = [...createdTokens].sort((a, b) => {
      let aVal: any, bVal: any;

      switch (createdSort.key) {
        case "name":
          aVal = a.name?.toLowerCase() || "";
          bVal = b.name?.toLowerCase() || "";
          break;
        case "mc":
          aVal =
            typeof a.marketCap === "number"
              ? a.marketCap
              : parseFloat(a.marketCap || "0");
          bVal =
            typeof b.marketCap === "number"
              ? b.marketCap
              : parseFloat(b.marketCap || "0");
          break;
        case "volume":
          aVal =
            typeof a.volume_24h === "number"
              ? a.volume_24h
              : parseFloat(a.volume_24h || "0");
          bVal =
            typeof b.volume_24h === "number"
              ? b.volume_24h
              : parseFloat(b.volume_24h || "0");
          break;
        case "change":
          aVal =
            typeof a.change24h === "number"
              ? a.change24h
              : parseFloat(a.change24h || "0");
          bVal =
            typeof b.change24h === "number"
              ? b.change24h
              : parseFloat(b.change24h || "0");
          break;
        case "holders":
          aVal = a.holders || 0;
          bVal = b.holders || 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return createdSort.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return createdSort.direction === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  };

  const SortIcon = ({
    active,
    direction,
  }: {
    active: boolean;
    direction: "asc" | "desc";
  }) => (
    <svg
      className={`w-3 h-3 inline ml-1 ${
        active ? "text-blue-600" : "text-art-gray-400"
      }`}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      {direction === "asc" ? (
        <path
          fillRule="evenodd"
          d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z"
          clipRule="evenodd"
        />
      ) : (
        <path
          fillRule="evenodd"
          d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      )}
    </svg>
  );

  useEffect(() => {
    const fetchPortfolio = async () => {
      if (!address) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [portfolioData, stats, txHistory] = await Promise.all([
          AnalyticsService.getPortfolio(address),
          AnalyticsService.getUserStats(address),
          AnalyticsService.getTransactionHistory(address, 20),
        ]);

        setPortfolio(portfolioData);
        setUserStats(stats);
        setTransactions(txHistory);

        // Fetch created tokens from Supabase and enrich with Zora API data
        try {
          // 1. Get tokens created by this user from Supabase
          const { data: platformTokens, error: dbError } = await supabase
            .from("drawcoins")
            .select("*")
            .ilike("creator_address", address);

          if (dbError) {
            console.error("Error fetching created tokens from DB:", dbError);
            setCreatedTokens([]);
          } else if (!platformTokens || platformTokens.length === 0) {
            setCreatedTokens([]);
          } else {
            // 2. Fetch Zora data for each token to get live stats
            const { getUserCreatedCoins } = await import(
              "../../services/portfolioService"
            );
            const { coins: zoraCoins } = await getUserCreatedCoins(
              address,
              100
            );

            // Create a map of Zora data by contract address
            const zoraDataMap = new Map(
              (zoraCoins || []).map((coin) => [
                coin.address?.toLowerCase(),
                coin,
              ])
            );

            // 3. Merge Supabase tokens with Zora live data
            const enrichedTokens = platformTokens.map((token) => {
              const zoraData = zoraDataMap.get(
                token.contract_address.toLowerCase()
              );

              return {
                ...token,
                // Use Zora's CDN-optimized images (same as holdings)
                image_url:
                  zoraData?.mediaContent?.previewImage?.medium ||
                  zoraData?.mediaContent?.previewImage?.small ||
                  token.image_url,
                // Live market data from Zora
                // Note: Zora API structure uses tokenPrice.priceInPoolToken for price
                current_price:
                  zoraData?.tokenPrice?.priceInPoolToken || token.current_price,
                volume_24h:
                  zoraData?.volume24h ||
                  zoraData?.totalVolume ||
                  token.volume_24h,
                holders: zoraData?.uniqueHolders || token.holders,
                marketCap: zoraData?.marketCap,
                change24h: zoraData?.marketCapDelta24h,
                // Keep full Zora data for reference
                zora_data: zoraData,
              };
            });

            setCreatedTokens(enrichedTokens);
          }
        } catch (createdError) {
          console.warn("Could not fetch created tokens:", createdError);
          setCreatedTokens([]);
        }

        // Fetch Zora profile data
        try {
          const profile = await getUserProfile(address);
          setZoraProfile(profile);
        } catch (profileError) {
          console.warn("Could not fetch Zora profile:", profileError);
        }
      } catch (error) {
        console.error("Failed to fetch portfolio:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, [address]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-art-gray-50 flex items-center justify-center p-4">
        <div className="hand-drawn-card max-w-md w-full text-center">
          <div className="hand-drawn-header">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <h2 className="text-xl">Portfolio</h2>
          </div>
          <p className="text-art-gray-600 mb-6">
            Connect your wallet to view your portfolio
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-art-gray-50 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Profile Skeleton */}
          <HandDrawnSkeleton variant="profile" />

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <HandDrawnSkeleton variant="stat" count={3} />
          </div>

          {/* Tabs Skeleton */}
          <div className="hand-drawn-card p-2">
            <HandDrawnSkeleton variant="text" className="w-full h-12" />
          </div>

          {/* Table Skeleton */}
          <HandDrawnSkeleton variant="table" count={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-art-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Profile Card with Zora Data */}
        <div className="hand-drawn-card">
          <div className="flex items-center space-x-4">
            {zoraProfile?.avatar?.medium ? (
              <img
                src={zoraProfile.avatar.medium}
                alt="Profile"
                className="w-16 h-16 rounded-full border-2 border-art-gray-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-art-gray-200 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-art-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-semibold text-art-gray-900">
                  {zoraProfile?.displayName ||
                    zoraProfile?.handle ||
                    "Anonymous"}
                </h3>
                {zoraProfile?.verified && (
                  <svg
                    className="w-5 h-5 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              {zoraProfile?.handle && (
                <p className="text-sm text-art-gray-600">
                  @{zoraProfile.handle}
                </p>
              )}
              <div className="flex items-center space-x-2 mt-1">
                {zoraProfile?.twitterUsername && (
                  <a
                    href={`https://twitter.com/${zoraProfile.twitterUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    🐦 Twitter
                  </a>
                )}
                {zoraProfile?.website && (
                  <a
                    href={
                      zoraProfile.website.startsWith("http://") ||
                      zoraProfile.website.startsWith("https://")
                        ? zoraProfile.website
                        : `https://${zoraProfile.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    🌐 Website
                  </a>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowShareModal(true)}
                className="hand-drawn-btn text-sm font-bold p-2 md:px-4 md:py-2 transform rotate-1"
                style={{
                  borderRadius: "8px 3px 6px 4px",
                }}
                title="Share Portfolio"
              >
                <div className="flex items-center md:space-x-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                  <span className="hidden md:inline">Share</span>
                </div>
              </button>
              <button
                onClick={() =>
                  window.open(
                    `https://zora.co/@${zoraProfile?.handle || "drawcoin"}`,
                    "_blank"
                  )
                }
                className="hand-drawn-btn text-sm font-bold p-2 md:px-4 md:py-2 transform -rotate-1 flex items-center md:space-x-2"
                style={{
                  borderRadius: "6px 4px 8px 3px",
                }}
                title="Zora Profile"
              >
                <img
                  src="https://pbs.twimg.com/profile_images/1912995896226443264/R9N6BIXd_400x400.jpg"
                  alt="Zora"
                  className="w-5 h-5 rounded-full"
                />
                <span className="hidden md:inline">Zora Profile</span>
              </button>
            </div>
          </div>
        </div>

        {/* Header Stats */}
        <div className="grid grid-cols-3 md:grid-cols-3 gap-2 md:gap-4">
          <div className="hand-drawn-card bg-blue-50 border-blue-200 p-2 md:p-4">
            <div className="text-[10px] md:text-sm text-blue-800 mb-0.5 md:mb-1 font-bold">
              Balance
            </div>
            <div className="text-base md:text-3xl font-bold text-blue-900">
              $
              {formatNumber(
                portfolio.reduce((sum, item) => {
                  const token = (item as any).token_details;
                  const zoraData = token?.zora_data;
                  const price = parseFloat(
                    zoraData?.tokenPrice?.priceInUsdc ||
                      token?.current_price ||
                      "0"
                  );
                  return sum + item.balance * price;
                }, 0)
              )}
            </div>
            <div className="text-[9px] md:text-xs text-blue-600 mt-0.5 md:mt-1 hidden md:block">
              Estimated Value
            </div>
          </div>

          <div className="hand-drawn-card p-2 md:p-4">
            <div className="text-[10px] md:text-sm text-art-gray-600 mb-0.5 md:mb-1 font-bold md:font-normal">
              Trades
            </div>
            <div className="text-base md:text-2xl font-bold text-art-gray-900">
              {userStats?.total_trades || 0}
            </div>
            <div className="text-[9px] md:text-xs text-art-gray-500 mt-0.5 md:mt-1 hidden md:block">
              Volume: ${formatNumber(userStats?.total_volume_usd || 0)}
            </div>
          </div>

          <div className="hand-drawn-card p-2 md:p-4">
            <div className="text-[10px] md:text-sm text-art-gray-600 mb-0.5 md:mb-1 font-bold md:font-normal">
              Created
            </div>
            <div className="text-base md:text-2xl font-bold text-art-gray-900">
              {createdTokens.length}
            </div>
            <div className="text-[9px] md:text-xs text-art-gray-500 mt-0.5 md:mt-1 hidden md:block">
              Tokens you launched
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="hand-drawn-card p-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("portfolio")}
              className={`flex-1 px-4 py-2.5 text-sm font-bold transition-all ${
                activeTab === "portfolio"
                  ? "hand-drawn-btn bg-blue-500 text-white border-blue-600"
                  : "hand-drawn-btn-dotted text-art-gray-700 border-art-gray-300 hover:bg-art-gray-50"
              }`}
            >
              Holdings ({portfolio.length})
            </button>
            <button
              onClick={() => setActiveTab("created")}
              className={`flex-1 px-4 py-2.5 text-sm font-bold transition-all ${
                activeTab === "created"
                  ? "hand-drawn-btn bg-blue-500 text-white border-blue-600"
                  : "hand-drawn-btn-dotted text-art-gray-700 border-art-gray-300 hover:bg-art-gray-50"
              }`}
            >
              Created Tokens ({createdTokens.length})
            </button>
            <button
              onClick={() => setActiveTab("transactions")}
              className={`flex-1 px-4 py-2.5 text-sm font-bold transition-all hidden md:block ${
                activeTab === "transactions"
                  ? "hand-drawn-btn bg-blue-500 text-white border-blue-600"
                  : "hand-drawn-btn-dotted text-art-gray-700 border-art-gray-300 hover:bg-art-gray-50"
              }`}
            >
              Transactions ({transactions.length})
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === "portfolio" ? (
          <div className="hand-drawn-card">
            <div className="hand-drawn-header">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
              <h2 className="text-xl">Your Holdings</h2>
            </div>

            {portfolio.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="w-16 h-16 text-art-gray-300 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p className="text-art-gray-600">No holdings yet</p>
                <p className="text-sm text-art-gray-500 mt-2">
                  Start trading to build your portfolio
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="border-b-2 border-art-gray-200 bg-art-gray-50">
                      <th
                        className="text-left px-2 md:px-3 py-2.5 text-xs md:text-sm font-semibold text-art-gray-700 cursor-pointer hover:bg-art-gray-100"
                        onClick={() => handlePortfolioSort("name")}
                      >
                        Token
                        <SortIcon
                          active={portfolioSort.key === "name"}
                          direction={portfolioSort.direction}
                        />
                      </th>
                      <th
                        className="text-right px-2 md:px-3 py-2.5 text-xs md:text-sm font-semibold text-art-gray-700 hidden lg:table-cell cursor-pointer hover:bg-art-gray-100"
                        onClick={() => handlePortfolioSort("mc")}
                      >
                        MC
                        <SortIcon
                          active={portfolioSort.key === "mc"}
                          direction={portfolioSort.direction}
                        />
                      </th>
                      <th
                        className="text-right px-2 md:px-3 py-2.5 text-xs md:text-sm font-semibold text-art-gray-700 hidden lg:table-cell cursor-pointer hover:bg-art-gray-100"
                        onClick={() => handlePortfolioSort("volume")}
                      >
                        Vol 24h
                        <SortIcon
                          active={portfolioSort.key === "volume"}
                          direction={portfolioSort.direction}
                        />
                      </th>
                      <th
                        className="text-right px-2 md:px-3 py-2.5 text-xs md:text-sm font-semibold text-art-gray-700 hidden lg:table-cell cursor-pointer hover:bg-art-gray-100"
                        onClick={() => handlePortfolioSort("change")}
                      >
                        Change
                        <SortIcon
                          active={portfolioSort.key === "change"}
                          direction={portfolioSort.direction}
                        />
                      </th>
                      <th
                        className="text-right px-2 md:px-3 py-2.5 text-xs md:text-sm font-semibold text-art-gray-700 cursor-pointer hover:bg-art-gray-100"
                        onClick={() => handlePortfolioSort("balance")}
                      >
                        Balance
                        <SortIcon
                          active={portfolioSort.key === "balance"}
                          direction={portfolioSort.direction}
                        />
                      </th>
                      <th className="text-center px-2 md:px-3 py-2.5 text-xs md:text-sm font-semibold text-art-gray-700"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedPortfolio().map((item) => {
                      const token = (item as any).token_details;
                      const zoraData = token?.zora_data;
                      const price = parseFloat(
                        zoraData?.tokenPrice?.priceInUsdc ||
                          token?.current_price ||
                          "0"
                      );
                      const holdingValue = item.balance * price;
                      return (
                        <tr
                          key={item.token_address}
                          className="border-b border-art-gray-100 hover:bg-art-gray-50 transition-colors"
                        >
                          <td className="px-2 md:px-3 py-3">
                            <div className="flex items-center space-x-2 md:space-x-3">
                              {token?.image_url && (
                                <img
                                  src={token.image_url}
                                  alt={token.name}
                                  className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0 border-2 border-art-gray-200"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              )}
                              <div className="min-w-0">
                                <div
                                  className="font-medium text-art-gray-900 text-sm md:text-base truncate max-w-[120px] md:max-w-[200px]"
                                  title={token?.name || "Unknown"}
                                >
                                  {token?.name || "Unknown"}
                                </div>
                                <div className="text-xs md:text-sm text-art-gray-500 truncate max-w-[100px] md:max-w-[150px]">
                                  {token?.symbol || ""}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 md:px-3 py-3 text-right text-xs md:text-sm hidden lg:table-cell">
                            {(() => {
                              const val =
                                typeof token?.marketCap === "number"
                                  ? token.marketCap
                                  : parseFloat(token?.marketCap || "0");
                              return val ? `$${formatNumber(val)}` : "-";
                            })()}
                          </td>
                          <td className="px-2 md:px-3 py-3 text-right text-xs md:text-sm hidden lg:table-cell">
                            {(() => {
                              const val =
                                typeof token?.volume24h === "number"
                                  ? token.volume24h
                                  : parseFloat(token?.volume24h || "0");
                              return val ? `$${formatNumber(val)}` : "-";
                            })()}
                          </td>
                          <td className="px-2 md:px-3 py-3 text-right hidden lg:table-cell">
                            {(() => {
                              const val =
                                typeof token?.change24h === "number"
                                  ? token.change24h
                                  : parseFloat(token?.change24h || "0");
                              return token?.change24h ? (
                                <span
                                  className={`text-xs md:text-sm font-semibold ${
                                    val >= 0 ? "text-green-600" : "text-red-600"
                                  }`}
                                >
                                  {val >= 0 ? "+" : ""}
                                  {val.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-xs md:text-sm text-art-gray-400">
                                  -
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-2 md:px-3 py-3 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-xs md:text-sm font-medium text-art-gray-900">
                                {formatNumber(item.balance)}
                              </span>
                              <span className="text-[10px] md:text-xs text-art-gray-500">
                                ${formatNumber(holdingValue)}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 md:px-3 py-3 text-center">
                            <button
                              onClick={() =>
                                onView
                                  ? onView(item.token_details)
                                  : router.push(`/coin/${item.token_address}`)
                              }
                              className="inline-flex items-center justify-center p-1.5 md:p-2 rounded-lg bg-art-gray-900 text-white hover:bg-art-gray-700 transition-colors"
                              title="View Token"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === "created" ? (
          <div className="hand-drawn-card">
            <div className="hand-drawn-header">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              <h2 className="text-xl">Your Tokens</h2>
            </div>

            {createdTokens.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="w-16 h-16 text-art-gray-300 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                <p className="text-art-gray-600">No tokens created yet</p>
                <p className="text-sm text-art-gray-500 mt-2">
                  Launch your first token to see it here
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="border-b-2 border-art-gray-200 bg-art-gray-50">
                      <th
                        className="text-left px-2 md:px-3 py-2.5 text-xs md:text-sm font-semibold text-art-gray-700 cursor-pointer hover:bg-art-gray-100"
                        onClick={() => handleCreatedSort("name")}
                      >
                        Token
                        <SortIcon
                          active={createdSort.key === "name"}
                          direction={createdSort.direction}
                        />
                      </th>
                      <th
                        className="text-right px-2 md:px-3 py-2.5 text-xs md:text-sm font-semibold text-art-gray-700 hidden lg:table-cell cursor-pointer hover:bg-art-gray-100"
                        onClick={() => handleCreatedSort("mc")}
                      >
                        MC
                        <SortIcon
                          active={createdSort.key === "mc"}
                          direction={createdSort.direction}
                        />
                      </th>
                      <th
                        className="text-right px-2 md:px-3 py-2.5 text-xs md:text-sm font-semibold text-art-gray-700 hidden lg:table-cell cursor-pointer hover:bg-art-gray-100"
                        onClick={() => handleCreatedSort("volume")}
                      >
                        Vol 24h
                        <SortIcon
                          active={createdSort.key === "volume"}
                          direction={createdSort.direction}
                        />
                      </th>
                      <th
                        className="text-right px-2 md:px-3 py-2.5 text-xs md:text-sm font-semibold text-art-gray-700 hidden lg:table-cell cursor-pointer hover:bg-art-gray-100"
                        onClick={() => handleCreatedSort("change")}
                      >
                        Change
                        <SortIcon
                          active={createdSort.key === "change"}
                          direction={createdSort.direction}
                        />
                      </th>
                      <th
                        className="text-right px-2 md:px-3 py-2.5 text-xs md:text-sm font-semibold text-art-gray-700 cursor-pointer hover:bg-art-gray-100"
                        onClick={() => handleCreatedSort("holders")}
                      >
                        Holders
                        <SortIcon
                          active={createdSort.key === "holders"}
                          direction={createdSort.direction}
                        />
                      </th>
                      <th className="text-center px-2 md:px-3 py-2.5 text-xs md:text-sm font-semibold text-art-gray-700"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedCreatedTokens().map((token) => {
                      return (
                        <tr
                          key={token.contract_address}
                          className="border-b border-art-gray-100 hover:bg-art-gray-50 transition-colors"
                        >
                          <td className="px-2 md:px-3 py-3">
                            <div className="flex items-center space-x-2 md:space-x-3">
                              {token.image_url && (
                                <img
                                  src={token.image_url}
                                  alt={token.name}
                                  className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0 border-2 border-art-gray-200"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              )}
                              <div className="min-w-0">
                                <div
                                  className="font-medium text-art-gray-900 text-sm md:text-base truncate max-w-[120px] md:max-w-[200px]"
                                  title={token.name || "Unknown"}
                                >
                                  {token.name || "Unknown"}
                                </div>
                                <div className="text-xs md:text-sm text-art-gray-500 truncate max-w-[100px] md:max-w-[150px]">
                                  {token.symbol || ""}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 md:px-3 py-3 text-right text-xs md:text-sm hidden lg:table-cell">
                            {(() => {
                              const val =
                                typeof token.marketCap === "number"
                                  ? token.marketCap
                                  : parseFloat(token.marketCap || "0");
                              return val ? `$${formatNumber(val)}` : "-";
                            })()}
                          </td>
                          <td className="px-2 md:px-3 py-3 text-right text-xs md:text-sm hidden lg:table-cell">
                            {(() => {
                              const val =
                                typeof token.volume_24h === "number"
                                  ? token.volume_24h
                                  : parseFloat(token.volume_24h || "0");
                              return val ? `$${formatNumber(val)}` : "-";
                            })()}
                          </td>
                          <td className="px-2 md:px-3 py-3 text-right hidden lg:table-cell">
                            {(() => {
                              const val =
                                typeof token.change24h === "number"
                                  ? token.change24h
                                  : parseFloat(token.change24h || "0");
                              return token.change24h ? (
                                <span
                                  className={`text-xs md:text-sm font-semibold ${
                                    val >= 0 ? "text-green-600" : "text-red-600"
                                  }`}
                                >
                                  {val >= 0 ? "+" : ""}
                                  {val.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-xs md:text-sm text-art-gray-400">
                                  -
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-2 md:px-3 py-3 text-right text-xs md:text-sm">
                            {token.holders || 1}
                          </td>
                          <td className="px-2 md:px-3 py-3 text-center">
                            <button
                              onClick={() =>
                                onView
                                  ? onView(token)
                                  : router.push(
                                      `/coin/${token.contract_address}`
                                    )
                              }
                              className="inline-flex items-center justify-center p-1.5 md:p-2 rounded-lg bg-art-gray-900 text-white hover:bg-art-gray-700 transition-colors"
                              title="View Token"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === "transactions" ? (
          <TransactionHistory transactions={transactions} />
        ) : null}
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        portfolioValue={portfolio.reduce((sum, item) => {
          const token = (item as any).token_details;
          const zoraData = token?.zora_data;
          const price = parseFloat(
            zoraData?.tokenPrice?.priceInUsdc || token?.current_price || "0"
          );
          return sum + item.balance * price;
        }, 0)}
        totalPnL={userStats?.total_pnl_usd || 0}
        tokenCount={portfolio.length}
        userName={zoraProfile?.displayName || zoraProfile?.handle}
        userAddress={address}
      />
    </div>
  );
}
