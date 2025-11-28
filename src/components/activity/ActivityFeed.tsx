"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import HandDrawnSkeleton from "../ui/HandDrawnSkeleton";

interface ActivityItem {
  id: string;
  tx_hash: string;
  type: "buy" | "sell" | "create";
  amount_token: number;
  amount_usd: number;
  timestamp: string;
  user_address: string;
  token_address: string;
  token_details?: {
    name: string;
    symbol: string;
    image_url: string;
  };
  user?: {
    username?: string;
    avatar_url?: string;
  };
}

export default function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<"all" | "buy" | "sell" | "create">(
    "all"
  );

  const fetchActivity = useCallback(
    async (reset = false) => {
      if (loadingMore && !reset) return;

      try {
        const currentPage = reset ? 0 : page;
        const limit = 20;
        const offset = currentPage * limit;

        if (!reset) setLoadingMore(true);

        const typeParam = filter !== "all" ? `&type=${filter}` : "";
        const res = await fetch(
          `/api/activity?limit=${limit}&offset=${offset}${typeParam}`
        );
        const data = await res.json();
        const newActivities: ActivityItem[] = data.data || [];

        if (newActivities.length < limit) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }

        setActivities((prev) =>
          reset ? newActivities : [...prev, ...newActivities]
        );
        setPage((prev) => (reset ? 1 : prev + 1));

        // Extract unique addresses for profile fetching
        const uniqueAddresses = Array.from(
          new Set(newActivities.map((a) => a.user_address))
        );

        if (uniqueAddresses.length > 0) {
          // Fetch profiles (Farcaster & Zora)
          const addressesParam = uniqueAddresses.join(",");

          // Fetch in parallel but don't block UI
          Promise.all([
            fetch(`/api/farcaster/users?addresses=${addressesParam}`)
              .then((r) => r.json())
              .catch(() => ({})),
            fetch(`/api/zora/profiles?addresses=${addressesParam}`)
              .then((r) => r.json())
              .catch(() => ({})),
          ]).then(([farcasterData, zoraData]) => {
            // Merge profiles
            const mergedProfiles: Record<string, any> = {};
            uniqueAddresses.forEach((addr) => {
              const lowerAddr = addr.toLowerCase();
              const fc = farcasterData[lowerAddr];
              const zora = zoraData[lowerAddr];

              mergedProfiles[lowerAddr] = {
                displayName:
                  zora?.displayName ||
                  fc?.displayName ||
                  zora?.handle ||
                  fc?.username,
                username: zora?.handle || fc?.username,
                avatar:
                  zora?.avatar?.medium || zora?.avatar?.small || fc?.pfpUrl,
              };
            });
            setProfiles((prev) => ({ ...prev, ...mergedProfiles }));
          });
        }
      } catch (error) {
        console.error("Failed to fetch activity:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [page, loadingMore, filter]
  );

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    setActivities([]);
    setLoading(true);
    fetchActivity(true);
  }, [filter]);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
          document.documentElement.offsetHeight - 100 &&
        hasMore &&
        !loadingMore
      ) {
        fetchActivity(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, loadingMore, fetchActivity]);

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 4)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-black text-art-gray-900 transform -rotate-1">
          Live Canvas 🎨
        </h2>

        <div className="flex p-1 bg-art-gray-100 rounded-xl border-2 border-art-gray-200">
          {(["all", "buy", "sell", "create"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`
                px-4 py-1.5 rounded-lg text-sm font-bold transition-all capitalize
                ${
                  filter === type
                    ? "bg-white text-art-gray-900 shadow-sm border-2 border-art-gray-900 transform -rotate-1"
                    : "text-art-gray-500 hover:text-art-gray-700"
                }
              `}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {loading && activities.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="hand-drawn-card p-4 flex items-center space-x-3"
            >
              <HandDrawnSkeleton  className="w-10 h-10" />
              <div className="flex-1 space-y-2">
                <HandDrawnSkeleton variant="text" className="w-3/4 h-4" />
                <HandDrawnSkeleton variant="text" className="w-1/2 h-3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => {
            const profile = profiles[activity.user_address.toLowerCase()];
            const displayName =
              profile?.displayName || formatAddress(activity.user_address);
            const avatarUrl = profile?.avatar;
            const isBuy = activity.type === "buy";
            const isCreate = activity.type === "create";

            return (
              <Link
                href={`/coin/${activity.token_address}`}
                key={activity.id || activity.tx_hash}
                className="hand-drawn-card p-4 flex items-start space-x-4 hover:scale-[1.01] transition-transform cursor-pointer block"
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-12 h-12 rounded-full border-2 border-art-gray-900 object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-art-gray-100 border-2 border-art-gray-900 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-art-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
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
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-base font-bold text-art-gray-900 truncate">
                      {displayName}
                    </p>
                    <span className="text-xs text-art-gray-400 whitespace-nowrap ml-2 font-medium">
                      {(() => {
                        try {
                          if (!activity.timestamp) return "";
                          const dateStr = activity.timestamp.endsWith("Z")
                            ? activity.timestamp
                            : activity.timestamp + "Z";
                          const date = new Date(dateStr);
                          if (isNaN(date.getTime())) return "";
                          return formatDistanceToNow(date, { addSuffix: true });
                        } catch (e) {
                          return "";
                        }
                      })()}
                    </span>
                  </div>

                  <div className="mt-1">
                    {isCreate ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        Created Token
                      </span>
                    ) : isBuy ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                        Bought
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                        Sold
                      </span>
                    )}

                    <span className="ml-2 text-sm text-art-gray-600">
                      {activity.amount_token > 0 && (
                        <span className="font-bold">
                          {formatNumber(activity.amount_token)}{" "}
                        </span>
                      )}
                      <span className="font-black text-art-gray-900">
                        {activity.token_details?.symbol || "TOKEN"}
                      </span>
                    </span>
                  </div>

                  {activity.amount_usd > 0 && (
                    <p className="text-xs font-bold text-art-gray-400 mt-1">
                      ${formatNumber(activity.amount_usd)} USD
                    </p>
                  )}
                </div>

                {/* Token Image */}
                {activity.token_details?.image_url && (
                  <div className="flex-shrink-0 ml-2">
                    <img
                      src={activity.token_details.image_url}
                      alt={activity.token_details.symbol}
                      className="w-12 h-12 rounded-lg border-2 border-art-gray-900 object-cover shadow-sm transform rotate-2"
                    />
                  </div>
                )}
              </Link>
            );
          })}

          {activities.length === 0 && !loading && (
            <div className="text-center py-12 hand-drawn-card">
              <p className="text-art-gray-500 font-medium">
                No activity found.
              </p>
            </div>
          )}

          {loadingMore && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-art-gray-900"></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  if (num < 0.001) return "<0.001";
  return num.toFixed(3);
}
