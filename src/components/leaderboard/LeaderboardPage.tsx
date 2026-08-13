"use client";

import React, { useState, useEffect, useCallback } from "react";
import { formatNumber } from "../../utils/format";
import HandDrawnSkeleton from "../ui/HandDrawnSkeleton";

interface LeaderboardUser {
  address: string;
  username?: string | null;
  avatar_url?: string | null;
  coins_created?: number | null;
  total_volume_usd?: number | string | null;
}

interface LeaderboardResponse {
  data?: LeaderboardUser[];
  lastUpdated?: number;
}

function formatWalletAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatUsdVolume(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? `$${formatNumber(parsed)}` : "—";
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<"creators" | "buyers">("creators");
  const [creators, setCreators] = useState<LeaderboardUser[]>([]);
  const [buyers, setBuyers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Fetch Leaderboard Data
      const [creatorsRes, buyersRes] = await Promise.all([
        fetch("/api/leaderboard?type=creators&limit=50"),
        fetch("/api/leaderboard?type=buyers&limit=50"),
      ]);

      if (!creatorsRes.ok || !buyersRes.ok) {
        throw new Error("Leaderboard data is temporarily unavailable.");
      }

      const creatorsData = (await creatorsRes.json()) as LeaderboardResponse;
      const buyersData = (await buyersRes.json()) as LeaderboardResponse;

      setCreators(creatorsData.data || []);
      setBuyers(buyersData.data || []);

      // Use the latest timestamp
      setLastUpdated(
        Math.max(creatorsData.lastUpdated || 0, buyersData.lastUpdated || 0)
      );
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);
  const renderTable = (
    data: LeaderboardUser[],
    type: "creators" | "buyers"
  ) => (
    <div className="overflow-x-auto -mx-4 md:mx-0">
      <table className="w-full min-w-[350px]">
        <thead>
          <tr className="border-b-2 border-art-gray-200 bg-art-gray-50">
            <th className="text-left px-2 py-3 text-xs md:text-sm font-semibold text-art-gray-700 w-8 md:w-16">
              Rank
            </th>
            <th className="text-left px-2 py-3 text-xs md:text-sm font-semibold text-art-gray-700">
              User
            </th>
            <th className="text-right px-2 py-3 text-xs md:text-sm font-semibold text-art-gray-700 whitespace-nowrap w-[20%] md:w-auto">
              {type === "creators" ? "Created" : "Volume"}
            </th>
            <th className="text-right px-2 py-3 text-xs md:text-sm font-semibold text-art-gray-700 w-[25%] md:w-auto">
              Links
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((user, index) => {
            const username = user.username?.trim() || null;
            const walletLabel = formatWalletAddress(user.address);
            const displayName = username || walletLabel;
            const avatarUrl = user.avatar_url?.trim() || null;

            return (
              <tr
                key={user.address}
                className="border-b border-art-gray-100 hover:bg-art-gray-50 transition-colors"
              >
                <td className="px-2 py-3">
                  <div
                    className={`
                  w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full font-bold text-xs md:text-sm
                  ${
                    index === 0
                      ? "bg-yellow-100 text-yellow-700 border-2 border-yellow-200"
                      : index === 1
                      ? "bg-gray-100 text-gray-700 border-2 border-gray-200"
                      : index === 2
                      ? "bg-orange-100 text-orange-700 border-2 border-orange-200"
                      : "text-art-gray-500"
                  }
                `}
                  >
                    {index + 1}
                  </div>
                </td>
                <td className="px-2 py-3">
                  <div className="flex items-center space-x-2 md:space-x-3">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-art-gray-200 object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-art-gray-200 flex items-center justify-center border-2 border-art-gray-300">
                        <svg
                          className="w-4 h-4 md:w-5 md:h-5 text-art-gray-400"
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
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1">
                        <div className="font-medium text-sm md:text-base text-art-gray-900 truncate max-w-[100px] md:max-w-[180px]">
                          {displayName}
                        </div>
                      </div>
                      <div className="text-[10px] md:text-xs text-art-gray-500 truncate max-w-[100px] md:max-w-[180px]">
                        {walletLabel}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-3 text-right font-bold text-sm md:text-base text-art-gray-900 whitespace-nowrap">
                  {type === "creators"
                    ? (user.coins_created ?? "—")
                    : formatUsdVolume(user.total_volume_usd)}
                </td>
                <td className="px-2 py-3 text-right">
                  <div className="flex items-center justify-end">
                    <a
                      href={`https://zora.co/${user.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-2 py-1.5 text-[10px] md:text-xs font-bold text-art-gray-700 bg-white border border-art-gray-300 rounded-lg hover:bg-art-gray-50 transition-colors"
                      title="View on Zora"
                    >
                      Zora ↗
                    </a>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-art-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="hand-drawn-card text-center py-8 relative">
          <h1 className="text-3xl font-bold text-art-gray-900 mb-2 transform -rotate-1">
            Leaderboard
          </h1>
          <p className="text-art-gray-600">
            Top creators and buyers on DrawCoin
          </p>

          {/* Refresh Button & Last Updated */}
          <div className="absolute top-4 right-4 flex flex-col items-end">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing || loading}
              className={`
                p-2 rounded-full border-2 border-art-gray-300 bg-white hover:bg-art-gray-50 transition-all
                ${refreshing ? "animate-spin" : ""}
              `}
              title="Refresh Data"
            >
              <svg
                className="w-4 h-4 text-art-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            {lastUpdated && (
              <span className="text-[10px] text-art-gray-400 mt-1">
                Updated: {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="hand-drawn-card p-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveTab("creators")}
              className={`min-w-0 px-2 py-3 text-sm font-bold transition-all whitespace-nowrap sm:px-4 ${
                activeTab === "creators"
                  ? "hand-drawn-btn text-white"
                  : "hand-drawn-btn-dotted text-art-gray-700 border-art-gray-300 hover:bg-art-gray-50"
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <span>Creators</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab("buyers")}
              className={`min-w-0 px-2 py-3 text-sm font-bold transition-all whitespace-nowrap sm:px-4 ${
                activeTab === "buyers"
                  ? "hand-drawn-btn bg-green-500 text-white border-green-600"
                  : "hand-drawn-btn-dotted text-art-gray-700 border-art-gray-300 hover:bg-art-gray-50"
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <span>Buyers</span>
              </div>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="hand-drawn-card min-h-[400px]">
          {loading ? (
            <div className="space-y-4">
              <HandDrawnSkeleton variant="text" className="w-full h-12" />
              <HandDrawnSkeleton variant="text" className="w-full h-12" />
              <HandDrawnSkeleton variant="text" className="w-full h-12" />
              <HandDrawnSkeleton variant="text" className="w-full h-12" />
              <HandDrawnSkeleton variant="text" className="w-full h-12" />
            </div>
          ) : (
            <>
              {activeTab === "creators" && renderTable(creators, "creators")}
              {activeTab === "buyers" && renderTable(buyers, "buyers")}

              {((activeTab === "creators" && creators.length === 0) ||
                (activeTab === "buyers" && buyers.length === 0)) && (
                <div className="text-center py-12">
                  <p className="text-art-gray-500">No data available yet.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
