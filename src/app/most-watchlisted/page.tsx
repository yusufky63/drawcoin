"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWatchlist } from "@/hooks/useWatchlist";
import { SafeImage } from "@/components/ui/SafeImage";
import HandDrawnSkeleton from "@/components/ui/HandDrawnSkeleton";

export default function MostWatchlistedPage() {
  const router = useRouter();
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { watchlist, toggleWatchlist } = useWatchlist();
  const watchlistSet = new Set(watchlist.map((a) => a.toLowerCase()));

  const fetchTokens = useCallback(async (currentOffset: number) => {
    try {
      const res = await fetch(
        `/api/most-watchlisted?limit=20&offset=${currentOffset}`
      );
      const data = await res.json();

      if (data.tokens) {
        setTokens((prev) =>
          currentOffset === 0 ? data.tokens : [...prev, ...data.tokens]
        );
        setHasMore(data.hasMore);
      }
    } catch (error) {
      console.error("Failed to fetch watchlist leaderboard:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTokens(0);
  }, [fetchTokens]);

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const nextOffset = offset + 20;
          setOffset(nextOffset);
          fetchTokens(nextOffset);
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, offset, fetchTokens]);

  return (
    <div className="min-h-screen bg-art-off-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-12">
        {/* Header */}
        <div className="relative mb-8 text-center">
          <button
            onClick={() => router.push("/")}
            className="absolute left-0 top-1/2 -translate-y-1/2 p-2 hover:bg-art-gray-100 rounded-full transition-colors group z-10"
            title="Back to Home"
          >
            <svg
              className="w-6 h-6 text-art-gray-400 group-hover:text-art-gray-900 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>

          <div className="hand-drawn-header inline-block px-8 flex-col">
            <h1 className="text-lg ml-4 sm:text-2xl font-black text-art-gray-900 uppercase tracking-wider transform -rotate-1">
              Most Watchlisted
            </h1>
            <p className="text-art-gray-500 mt-2 font-medium text-xs sm:text-sm">
              The most popular tokens across the entire platform.
            </p>
          </div>
        </div>

        {/* Content */}
        {loading && tokens.length === 0 ? (
          <div className="grid grid-cols-1 gap-4">
            <HandDrawnSkeleton variant="card" count={3} />
          </div>
        ) : (
          <>
            <div className="hand-drawn-card p-0 overflow-hidden bg-white">
              {/* List Header */}
              <div className="grid grid-cols-12 gap-4 p-3 bg-art-gray-50 border-b-2 border-art-gray-100 text-[10px] font-black text-art-gray-400 uppercase tracking-wider">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-4 md:col-span-3">Token</div>
                <div className="hidden md:block col-span-2 text-right">MC</div>
                <div className="hidden md:block col-span-2 text-right">
                  Volume
                </div>
                <div className="hidden md:block col-span-1 text-right">
                  Holders
                </div>
                <div className="col-span-4 md:col-span-1 text-right">
                  Watchlist
                </div>
              </div>

              <div className="divide-y-2 divide-art-gray-100/50">
                {tokens.map((token, index) => {
                  const isFavorite = watchlistSet.has(
                    token.contract_address.toLowerCase()
                  );

                  return (
                    <div
                      key={token.contract_address}
                      className="grid grid-cols-12 gap-4 p-3 items-center hover:bg-blue-50/30 transition-colors cursor-pointer group"
                      onClick={() =>
                        router.push(`/coin/${token.contract_address}`)
                      }
                    >
                      {/* Rank */}
                      <div className="col-span-1 text-center font-black text-art-gray-300 text-lg italic">
                        {index + 1}
                      </div>

                      {/* Token Info */}
                      <div className="col-span-4 md:col-span-3 flex items-center gap-3 min-w-0">
                        <div className="relative w-10 h-10 flex-shrink-0">
                          <div className="w-full h-full rounded-lg overflow-hidden border border-art-gray-200 shadow-sm transform group-hover:rotate-2 transition-transform duration-300">
                            <SafeImage
                              src={token.image_url}
                              alt={token.name}
                              width={40}
                              height={40}
                              className="object-cover"
                            />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-sm text-art-gray-900 truncate group-hover:text-blue-600 transition-colors">
                            {token.name}
                          </h4>
                          <span className="text-[10px] font-bold text-art-gray-500 font-mono bg-art-gray-100 px-1 rounded border border-art-gray-200">
                            ${token.symbol}
                          </span>
                        </div>
                      </div>

                      {/* Market Cap */}
                      <div className="hidden md:block col-span-2 text-right">
                        {token.market_cap ? (
                          <span className="text-xs font-black text-art-gray-600 font-mono">
                            $
                            {parseFloat(token.market_cap.toString()) >= 1000000
                              ? (
                                  parseFloat(token.market_cap.toString()) /
                                  1000000
                                ).toFixed(1) + "M"
                              : (
                                  parseFloat(token.market_cap.toString()) / 1000
                                ).toFixed(1) + "K"}
                          </span>
                        ) : (
                          <span className="text-art-gray-300">-</span>
                        )}
                      </div>

                      {/* Volume */}
                      <div className="hidden md:block col-span-2 text-right">
                        {token.volume_24h ? (
                          <span className="text-xs font-black text-art-gray-600 font-mono">
                            $
                            {parseFloat(token.volume_24h.toString()) >= 1000000
                              ? (
                                  parseFloat(token.volume_24h.toString()) /
                                  1000000
                                ).toFixed(1) + "M"
                              : (
                                  parseFloat(token.volume_24h.toString()) / 1000
                                ).toFixed(1) + "K"}
                          </span>
                        ) : (
                          <span className="text-art-gray-300">-</span>
                        )}
                      </div>

                      {/* Holders */}
                      <div className="hidden md:block col-span-1 text-right">
                        {token.holders ? (
                          <span className="text-xs font-black text-art-gray-600 font-mono">
                            {token.holders}
                          </span>
                        ) : (
                          <span className="text-art-gray-300">-</span>
                        )}
                      </div>

                      {/* Action */}
                      <div className="col-span-4 md:col-span-1 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWatchlist(token.contract_address);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                            isFavorite
                              ? "text-red-500 bg-red-50"
                              : "text-art-gray-400 hover:text-red-400 hover:bg-art-gray-50"
                          }`}
                        >
                          <svg
                            className={`w-4 h-4 ${
                              isFavorite ? "fill-current" : "fill-none"
                            }`}
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                            />
                          </svg>
                          <span className="text-xs font-black">
                            {token.watchlist_count || 0}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sentinel */}
            <div
              ref={sentinelRef}
              className="py-8 text-center text-art-gray-400 font-mono text-sm"
            >
              {hasMore ? "Loading more gems..." : "You've reached the end!"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
