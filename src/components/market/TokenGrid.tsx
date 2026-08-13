import React from "react";
import Link from "next/link";
import { Coin } from "../../lib/supabase";
import {
  getCreatorDisplayLabel,
  normalizeCreatorAddress,
} from "../../lib/creatorIdentity";
import TokenCard from "./TokenCard";
import { WatchlistPriceHint } from "../../hooks/useWatchlist";
import { CreationTypeBadge } from "./CreationTypeBadge";

interface TokenGridProps {
  tokens: Coin[];
  loading?: boolean;
  viewMode?: "grid" | "list";
  showBalance?: boolean; // Optional prop to show user balance
  watchlistSet?: Set<string>; // Pre-computed watchlist Set for performance
  onToggleWatchlist?: (
    tokenAddress: string,
    priceHint?: WatchlistPriceHint
  ) => void; // Callback from parent
  watchlistStats?: Record<string, number>; // NEW: Watchlist counts map
  onCreatorClick?: (creatorAddress: string) => void; // NEW: Callback for creator click
  creatorBasenames?: Record<string, string | null>;
}

export default function TokenGrid({
  tokens,
  loading = false,
  viewMode = "grid",
  showBalance = false,
  watchlistSet,
  onToggleWatchlist,
  watchlistStats,
  onCreatorClick,
  creatorBasenames,
}: TokenGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="hand-drawn-card p-4 animate-pulse"
            style={{
              transform: `rotate(${index % 2 === 0 ? "-0.5deg" : "0.5deg"})`,
            }}
          >
            <div
              className="aspect-square bg-art-gray-200 rounded-art-lg mb-4"
              style={{ borderRadius: "15px 5px 10px 8px" }}
            ></div>
            <div className="space-y-3">
              <div className="h-5 bg-art-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-art-gray-200 rounded w-1/2"></div>
              <div className="flex justify-between">
                <div className="h-6 bg-art-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-art-gray-200 rounded w-1/4"></div>
              </div>
              <div className="h-4 bg-art-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-art-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-12 h-12 text-art-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-art-gray-900 mb-2">
          No tokens found
        </h3>
        <p className="text-art-gray-500">
          Try adjusting your search or filters to find more art tokens.
        </p>
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <div className="space-y-2 md:space-y-3">
        {tokens.map((token, index) => {
          const isFavorite =
            watchlistSet?.has(token.contract_address.toLowerCase()) || false;
          const watchlistCount = watchlistStats?.[token.contract_address] || 0;
          const creatorAddress = token.creator_address;
          const normalizedCreatorAddress =
            normalizeCreatorAddress(creatorAddress);
          const creatorProfile = (
            token as Coin & { creatorProfile?: { handle?: string | null } }
          ).creatorProfile;
          const creatorLabel = getCreatorDisplayLabel({
            address: creatorAddress,
            persistedName: creatorProfile?.handle ?? token.creator_name ?? null,
            resolvedBasename: normalizedCreatorAddress
              ? creatorBasenames?.[normalizedCreatorAddress]
              : null,
          });

          // Helper for price hint
          const resolvePriceNumber = (value: any) => {
            if (value === null || value === undefined) return undefined;
            const parsed =
              typeof value === "number" ? value : parseFloat(value);
            return Number.isFinite(parsed) ? parsed : undefined;
          };
          const watchlistPriceHint = {
            priceUsd: resolvePriceNumber(
              (token as any).tokenPrice?.priceInUsdc ??
                (token as any).tokenPrice?.priceInUsd ??
                token.current_price ??
                (token as any).current_price
            ),
            priceEth: resolvePriceNumber(
              (token as any).tokenPrice?.priceInPoolToken ??
                (token as any).tokenPrice?.priceInEth
            ),
          };

          return (
            <article
              key={token.id || token.contract_address}
              className="hand-drawn-card relative p-2 md:p-3 group flex items-center gap-3"
              style={{
                transform: `rotate(${index % 2 === 0 ? "-0.2deg" : "0.2deg"})`,
              }}
            >
              <Link
                href={`/coin/${token.contract_address}`}
                aria-label={`View ${(token as any).name || token.name || "token"} details`}
                className="absolute inset-0 z-10 rounded-art focus-visible:ring-4 focus-visible:ring-blue-500 focus-visible:ring-inset"
              >
                <span className="sr-only">
                  View {(token as any).name || token.name || "token"} details
                </span>
              </Link>

              {/* NEW Badge */}
              {(token as any).isNew && (
                <div className="absolute -top-2 -right-2 z-50 bg-yellow-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full transform rotate-12 shadow-sm border border-white">
                  NEW
                </div>
              )}

              {/* Token Logo */}
              <div
                className="w-16 h-16 md:w-20 md:h-20 bg-art-gray-50 overflow-hidden flex-shrink-0 flex items-center justify-center relative"
                style={{
                  border: "2px solid #2d3748",
                  borderRadius: "15px 5px 10px 8px",
                  transform: "rotate(0.5deg)",
                }}
              >
                {(() => {
                  const imageUrl =
                    (token as any).mediaContent?.previewImage?.small ||
                    token.image_url;
                  return imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={(token as any).name || token.name}
                      className="w-auto h-auto max-w-[90%] max-h-[90%] object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        const nextElement = e.currentTarget
                          .nextElementSibling as HTMLElement;
                        if (nextElement) {
                          nextElement.style.display = "flex";
                        }
                      }}
                    />
                  ) : null;
                })()}
                <div className="w-full h-full hidden items-center justify-center text-art-gray-400 text-lg">
                  🎨
                </div>

              </div>

              {/* Token Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-art-gray-900 text-sm md:text-base truncate transform -rotate-0.5">
                    {(token as any).name || token.name}
                  </h3>
                  <span className="text-[10px] text-art-gray-500 font-mono bg-art-gray-100 px-1 rounded transform rotate-1">
                    {(token as any).symbol || token.symbol}
                  </span>
                  <CreationTypeBadge
                    creationType={token.creation_type}
                    compact
                    className="shrink-0"
                  />
                </div>

                {/* Creator Info */}
                {creatorLabel &&
                  (onCreatorClick && creatorAddress ? (
                    <button
                      type="button"
                      className="relative z-20 block max-w-full text-left text-[10px] text-art-gray-500 truncate transform -rotate-0.5 hover:text-blue-500 hover:underline focus-visible:text-blue-600 focus-visible:underline"
                      onClick={() => onCreatorClick(creatorAddress)}
                      aria-label={`View creator ${creatorLabel}`}
                    >
                      by {creatorLabel}
                    </button>
                  ) : (
                    <p className="text-[10px] text-art-gray-500 truncate transform -rotate-0.5">
                      by {creatorLabel}
                    </p>
                  ))}

                {/* Market Data Grid (Mini Version) */}
                <div className="flex gap-2 mt-1">
                  <div
                    className="bg-art-gray-50 px-2 py-0.5 md:px-4 md:py-1 md:min-w-[80px] rounded-art text-center transform -rotate-1 border border-art-gray-100"
                    style={{ borderRadius: "8px 4px 6px 3px" }}
                  >
                    <div className="text-[10px] md:text-sm font-bold text-art-gray-900">
                      {(() => {
                        const mc = (token as any).marketCap;
                        const num = Number(mc);
                        if (!Number.isFinite(num) || num <= 0) return "—";
                        return num >= 1000000
                          ? `$${(num / 1000000).toFixed(1)}M`
                          : num >= 1000
                          ? `$${(num / 1000).toFixed(1)}K`
                          : `$${num.toFixed(0)}`;
                      })()}
                    </div>
                    <div className="text-[8px] md:text-xs text-art-gray-400">
                      MC
                    </div>
                  </div>
                  <div
                    className="bg-art-gray-50 px-2 py-0.5 md:px-4 md:py-1 md:min-w-[80px] rounded-art text-center transform rotate-1 border border-art-gray-100"
                    style={{ borderRadius: "6px 8px 3px 5px" }}
                  >
                    <div className="text-[10px] md:text-sm font-bold text-art-gray-900">
                      {(() => {
                        const vol = token.volume_24h;
                        const num = Number(vol);
                        if (
                          vol === null ||
                          vol === undefined ||
                          !Number.isFinite(num) ||
                          num <= 0
                        )
                          return "—";
                        return num >= 1000000
                          ? `$${(num / 1000000).toFixed(1)}M`
                          : num >= 1000
                          ? `$${(num / 1000).toFixed(1)}K`
                          : `$${num.toFixed(0)}`;
                      })()}
                    </div>
                    <div className="text-[8px] md:text-xs text-art-gray-400">
                      VOL
                    </div>
                  </div>
                  <div
                    className="bg-art-gray-50 px-2 py-0.5 md:px-4 md:py-1 md:min-w-[80px] rounded-art text-center transform rotate-0.5 border border-art-gray-100"
                    style={{ borderRadius: "5px 7px 4px 6px" }}
                  >
                    <div className="text-[10px] md:text-sm font-bold text-art-gray-900">
                      {(() => {
                        const holders = (token as any).holders;
                        const count = Number(holders);
                        return holders === null ||
                          holders === undefined ||
                          !Number.isFinite(count) ||
                          count < 0
                          ? "—"
                          : count.toLocaleString();
                      })()}
                    </div>
                    <div className="text-[8px] md:text-xs text-art-gray-400">
                      HOLDERS
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Price Change & Actions */}
              <div className="flex flex-col items-end gap-2">
                <div
                  className={`text-sm font-bold ${(() => {
                    const priceChange = (token as any).marketCapDelta24h;
                    const val = Number(priceChange);
                    if (val > 0) return "text-green-600";
                    if (val < 0) return "text-red-600";
                    return "text-art-gray-500";
                  })()}`}
                >
                  {(() => {
                    const priceChange = (token as any).marketCapDelta24h;
                    const val = Number(priceChange);
                    return priceChange !== null &&
                      priceChange !== undefined &&
                      Number.isFinite(val)
                      ? `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`
                      : "—";
                  })()}
                </div>

                <div className="flex items-center gap-2">
                  {/* Watchlist Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onToggleWatchlist) {
                        onToggleWatchlist(
                          token.contract_address,
                          watchlistPriceHint
                        );
                      }
                    }}
                    aria-label={
                      isFavorite
                        ? `Remove ${(token as any).name || token.name || "token"} from watchlist`
                        : `Add ${(token as any).name || token.name || "token"} to watchlist`
                    }
                    aria-pressed={isFavorite}
                    disabled={!onToggleWatchlist}
                    className={`relative z-20 flex items-center gap-1 px-2 py-1.5 rounded-full transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                      isFavorite
                        ? "bg-white/90 text-red-500"
                        : "bg-white/90 text-art-gray-400 hover:text-red-400"
                    }`}
                  >
                    <svg
                      className={`w-3 h-3 ${
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
                    {watchlistCount > 0 && (
                      <span className="text-[10px] font-bold">
                        {watchlistCount}
                      </span>
                    )}
                  </button>

                </div>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1 md:gap-4">
      {tokens.map((token) => (
        <TokenCard
          key={token.id || token.contract_address}
          token={token}
          showBalance={showBalance}
          watchlistSet={watchlistSet}
          onToggleWatchlist={onToggleWatchlist}
          watchlistCount={watchlistStats?.[token.contract_address] || 0}
          onCreatorClick={onCreatorClick}
          creatorBasename={
            creatorBasenames?.[
              normalizeCreatorAddress(token.creator_address) ?? ""
            ] ?? null
          }
        />
      ))}
    </div>
  );
}
