"use client";

import React, { useState, useEffect, useCallback } from "react";
import { formatNumber } from "../../utils/format";
import HandDrawnSkeleton from "../ui/HandDrawnSkeleton";

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<"creators" | "buyers">("creators");
  const [creators, setCreators] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [zoraProfiles, setZoraProfiles] = useState<Record<string, any>>({});
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Fetch Leaderboard Data
      const refreshParam = isRefresh ? "&refresh=true" : "";
      const [creatorsRes, buyersRes] = await Promise.all([
        fetch(`/api/leaderboard?type=creators&limit=50${refreshParam}`),
        fetch(`/api/leaderboard?type=buyers&limit=50${refreshParam}`),
      ]);

      const creatorsData = await creatorsRes.json();
      const buyersData = await buyersRes.json();

      setCreators(creatorsData.data || []);
      setBuyers(buyersData.data || []);

      // Use the latest timestamp
      setLastUpdated(
        Math.max(creatorsData.lastUpdated || 0, buyersData.lastUpdated || 0)
      );

      // Extract all unique addresses for profiles
      const allAddresses = new Set([
        ...(creatorsData.data || []).map((c: any) => c.address),
        ...(buyersData.data || []).map((b: any) => b.address),
      ]);

      if (allAddresses.size > 0) {
        const addressesParam = Array.from(allAddresses).join(",");

        // Fetch Profiles (Farcaster & Zora) in parallel
        const [farcasterRes, zoraRes] = await Promise.all([
          fetch(`/api/farcaster/users?addresses=${addressesParam}`),
          fetch(`/api/zora/profiles?addresses=${addressesParam}`),
        ]);

        if (farcasterRes.ok) {
          const profilesData = await farcasterRes.json();
          setProfiles(profilesData);
        }

        if (zoraRes.ok) {
          const zoraData = await zoraRes.json();
          setZoraProfiles(zoraData);
        }
      }
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const renderTable = (data: any[], type: "creators" | "buyers") => (
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
            const farcasterProfile = profiles[user.address?.toLowerCase()];
            const zoraProfile = zoraProfiles[user.address?.toLowerCase()];

            // Prioritize Zora profile data if available, fallback to Farcaster, then DB
            const displayName =
              zoraProfile?.displayName ||
              farcasterProfile?.displayName ||
              zoraProfile?.handle ||
              farcasterProfile?.username ||
              user.username ||
              `${user.address.substring(0, 6)}...${user.address.substring(
                user.address.length - 4
              )}`;

            const username =
              zoraProfile?.handle ||
              farcasterProfile?.username ||
              user.username;

            const avatarUrl =
              zoraProfile?.avatar?.medium ||
              zoraProfile?.avatar?.small ||
              farcasterProfile?.pfpUrl ||
              user.avatar_url;

            // Social links
            const twitterUsername =
              zoraProfile?.socialAccounts?.twitter?.username;

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
                      {username && (
                        <div className="text-[10px] md:text-xs text-art-gray-500 truncate max-w-[100px] md:max-w-[180px]">
                          @{username}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-2 py-3 text-right font-bold text-sm md:text-base text-art-gray-900 whitespace-nowrap">
                  {type === "creators"
                    ? user.coins_created || 0
                    : `$${formatNumber(user.total_volume_usd || 0)}`}
                </td>
                <td className="px-2 py-3 text-right">
                  <div className="flex items-center justify-end space-x-1 md:space-x-2">
                    {farcasterProfile?.username && (
                      <a
                        href={`https://warpcast.com/${farcasterProfile.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 md:p-2 text-art-gray-500 hover:text-purple-600 transition-colors"
                        title="Farcaster"
                      >
                        <img
                          src="https://warpcast.com/favicon.ico"
                          alt="FC"
                          className="w-3 h-3 md:w-4 md:h-4"
                        />
                      </a>
                    )}
                    {twitterUsername && (
                      <a
                        href={`https://twitter.com/${twitterUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 md:p-2 text-art-gray-500 hover:text-blue-400 transition-colors"
                        title="Twitter"
                      >
                        <svg
                          className="w-3 h-3 md:w-4 md:h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                        </svg>
                      </a>
                    )}
                    <a
                      href={`https://zora.co/${user.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center p-1.5 md:p-2 text-xs font-bold text-art-gray-700 bg-white border border-art-gray-300 rounded-lg hover:bg-art-gray-50 transition-colors"
                      title="View on Zora"
                    >
                      <img
                        src="https://pbs.twimg.com/profile_images/1912995896226443264/R9N6BIXd_400x400.jpg"
                        alt="Zora"
                        className="w-3 h-3 md:w-4 md:h-4 rounded-full"
                      />
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
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            <button
              onClick={() => setActiveTab("creators")}
              className={`flex-1 min-w-[120px] px-4 py-3 text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === "creators"
                  ? "hand-drawn-btn bg-blue-500 text-white border-blue-600"
                  : "hand-drawn-btn-dotted text-art-gray-700 border-art-gray-300 hover:bg-art-gray-50"
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <span>Creators</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab("buyers")}
              className={`flex-1 min-w-[120px] px-4 py-3 text-sm font-bold transition-all whitespace-nowrap ${
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
