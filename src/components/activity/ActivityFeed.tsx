"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
    username?: string | null;
    avatar_url?: string | null;
  } | null;
}

export default function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const [filter, setFilter] = useState<"all" | "buy" | "sell" | "create">(
    "all"
  );

  const fetchActivity = useCallback(
    async (reset = false) => {
      if (loadingMoreRef.current && !reset) return;

      const requestGeneration = reset
        ? ++requestGenerationRef.current
        : requestGenerationRef.current;
      loadingMoreRef.current = true;

      try {
        const currentPage = reset ? 0 : pageRef.current;
        const limit = 20;
        const offset = currentPage * limit;

        if (!reset) setLoadingMore(true);

        const typeParam = filter !== "all" ? `&type=${filter}` : "";
        const res = await fetch(
          `/api/activity?limit=${limit}&offset=${offset}${typeParam}`
        );
        if (!res.ok) {
          throw new Error("Activity data is temporarily unavailable.");
        }
        const data = await res.json();
        const newActivities: ActivityItem[] = data.data || [];

        if (requestGeneration !== requestGenerationRef.current) return;

        if (newActivities.length < limit) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }

        setActivities((prev) =>
          reset ? newActivities : [...prev, ...newActivities]
        );
        pageRef.current = reset ? 1 : currentPage + 1;
      } catch (error) {
        console.error("Failed to fetch activity:", error);
      } finally {
        if (requestGeneration === requestGenerationRef.current) {
          loadingMoreRef.current = false;
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [filter]
  );

  useEffect(() => {
    pageRef.current = 0;
    setHasMore(true);
    setActivities([]);
    setLoading(true);
    void fetchActivity(true);

    return () => {
      requestGenerationRef.current += 1;
      loadingMoreRef.current = false;
    };
  }, [fetchActivity]);

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
            const displayName =
              activity.user?.username?.trim() ||
              formatAddress(activity.user_address);
            const avatarUrl = activity.user?.avatar_url?.trim() || null;
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
                        } catch {
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
