import React, { useMemo } from "react";
import Link from "next/link";
import { Coin } from "../../lib/supabase";
import { getCreatorDisplayLabel } from "../../lib/creatorIdentity";
import { WatchlistPriceHint } from "../../hooks/useWatchlist";
import { SafeImage } from "../ui/SafeImage";
import { CreationTypeBadge } from "./CreationTypeBadge";

interface TokenCardProps {
  token: Coin;
  showBalance?: boolean; // Optional prop to show user balance
  watchlistSet?: Set<string>; // Pre-computed Set for O(1) lookup
  onToggleWatchlist?: (
    tokenAddress: string,
    priceHint?: WatchlistPriceHint
  ) => void; // Callback from parent
  watchlistCount?: number; // NEW: Watchlist count
  onCreatorClick?: (creatorAddress: string) => void; // NEW: Callback for creator click
  creatorBasename?: string | null;
}

export function TokenCard({
  token,
  showBalance = false,
  watchlistSet,
  onToggleWatchlist,
  watchlistCount,
  onCreatorClick,
  creatorBasename,
}: TokenCardProps) {
  // Use watchlistSet for O(1) lookup - no more hook call!
  const isFavorite = useMemo(() => {
    return watchlistSet?.has(token.contract_address.toLowerCase()) || false;
  }, [watchlistSet, token.contract_address]);
  const resolvePriceNumber = (value: any) => {
    if (value === null || value === undefined) return undefined;
    const parsed = typeof value === "number" ? value : parseFloat(value);
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

  const tokenName = (token as any).name || token.name || "token";
  const creatorAddress = token.creator_address;
  const creatorProfile = (
    token as Coin & { creatorProfile?: { handle?: string | null } }
  ).creatorProfile;
  const creatorLabel = getCreatorDisplayLabel({
    address: creatorAddress,
    persistedName: creatorProfile?.handle ?? token.creator_name ?? null,
    resolvedBasename: creatorBasename,
  });

  return (
    <article
      className="hand-drawn-card token-card-shell group relative"
      style={{ transform: "rotate(-0.5deg)" }}
    >
      <Link
        href={`/coin/${token.contract_address}`}
        aria-label={`View ${tokenName} details`}
        className="absolute inset-0 z-10 rounded-art focus-visible:ring-4 focus-visible:ring-blue-500 focus-visible:ring-inset"
      >
        <span className="sr-only">View {tokenName} details</span>
      </Link>

      {/* NEW Badge */}
      {(token as any).isNew && (
        <div
          className="absolute -top-3 -right-3 z-50 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full transform rotate-12 shadow-lg border-2 border-white"
          style={{
            borderRadius: "10px 3px 8px 5px",
            fontSize: "10px",
            lineHeight: "1",
            zIndex: 50,
            top: "-12px",
            right: "-12px",
          }}
        >
          NEW
        </div>
      )}

      {/* Favorite Button */}
      {/* Favorite Button with Count */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onToggleWatchlist) {
            onToggleWatchlist(token.contract_address, watchlistPriceHint);
          }
        }}
        aria-label={
          isFavorite
            ? `Remove ${tokenName} from watchlist`
            : `Add ${tokenName} to watchlist`
        }
        aria-pressed={isFavorite}
        className={`absolute top-3 right-3 z-30 flex items-center gap-1 px-2 py-1 rounded-full transition-colors shadow-sm ${
          isFavorite
            ? "bg-white/90 text-red-500"
            : "bg-white/90 text-art-gray-400 hover:text-red-400"
        }`}
        disabled={!onToggleWatchlist}
      >
        <svg
          className={`w-4 h-4 ${isFavorite ? "fill-current" : "fill-none"}`}
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
        {watchlistCount !== undefined && watchlistCount > 0 && (
          <span className="text-xs font-bold">{watchlistCount}</span>
        )}
      </button>

      {/* Creation Type Badge - Minimal Version */}
      <CreationTypeBadge
        creationType={token.creation_type}
        className="absolute left-3 top-3 z-30"
      />

      {/* Token Image - with lazy loading */}
      <div
        className="w-full bg-art-gray-50 rounded-art-lg mb-2 md:mb-3 overflow-hidden relative flex items-center justify-center"
        style={{
          border: "2px solid #2d3748",
          borderRadius: "20px 10px 25px 15px",
          transform: "rotate(0.5deg)",
          height: "200px",
          minHeight: "180px",
          aspectRatio: "1/1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SafeImage
          src={
            (token as any).mediaContent?.previewImage?.small ||
            token.image_url ||
            ""
          }
          alt={(token as any).name || token.name || "Token"}
          width={200}
          height={200}
          className="group-hover:scale-105 transition-transform duration-300"
          fallbackText="🎨"
          lazy={true}
          fluid={true}
        />
      </div>

      {/* Token Info */}
      <div className="space-y-3">
        <div className="">
          <div className="flex min-w-0 items-baseline justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-baseline gap-2">
              <h3 className="min-w-0 truncate font-bold text-art-gray-900 text-sm leading-tight transform rotate-0.5">
                {(token as any).name || token.name}
              </h3>
              <p className="max-w-[40%] shrink-0 truncate text-[10px] text-art-gray-500 font-mono bg-art-gray-100 px-1 py-0.5 rounded-art transform -rotate-1">
                {(token as any).symbol || token.symbol}
              </p>
            </div>
            <div
              className={`shrink-0 text-[12px] font-bold ${(() => {
                const priceChange = (token as any).marketCapDelta24h;
                const value = Number(priceChange);
                if (Number.isFinite(value) && value > 0) return "text-green-600";
                if (Number.isFinite(value) && value < 0) return "text-red-600";
                return "text-art-gray-900";
              })()}`}
            >
              {(() => {
                const priceChange = (token as any).marketCapDelta24h;
                const value = Number(priceChange);
                return priceChange !== null &&
                  priceChange !== undefined &&
                  Number.isFinite(value)
                  ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
                  : "—";
              })()}
            </div>
          </div>
          {creatorLabel &&
            (onCreatorClick && creatorAddress ? (
              <button
                type="button"
                className="relative z-30 block max-w-full text-left text-[11px] text-art-gray-500 truncate transform -rotate-0.5 hover:text-blue-500 hover:underline focus-visible:text-blue-600 focus-visible:underline"
                onClick={() => onCreatorClick(creatorAddress)}
                aria-label={`View creator ${creatorLabel}`}
              >
                by {creatorLabel}
              </button>
            ) : (
              <p className="text-[11px] text-art-gray-500 truncate transform -rotate-0.5">
                by {creatorLabel}
              </p>
            ))}
        </div>

        {/* User Balance (only shown in portfolio) */}
        {showBalance && (token as any).userBalanceFormatted && (
          <div
            className="bg-blue-50 border border-blue-200 p-2 rounded-art transform -rotate-0.5 mb-2"
            style={{ borderRadius: "8px 12px 6px 10px" }}
          >
            <div className="text-center">
              <div className="text-sm font-bold text-blue-900">
                {(token as any).userBalanceFormatted}{" "}
                {(token as any).symbol || token.symbol}
              </div>
              <div className="text-xs text-blue-600">Your Balance</div>
            </div>
          </div>
        )}

        {/* Market Data */}
        <div className="grid grid-cols-3 gap-1 md:gap-2 text-center">
          <div
            className="bg-art-gray-50 p-1 md:p-2 rounded-art transform -rotate-1"
            style={{ borderRadius: "15px 5px 10px 8px" }}
          >
            <div className="text-sm font-bold text-art-gray-900">
              {(() => {
                const mc = (token as any).marketCap;
                const numMc = Number(mc);
                if (!Number.isFinite(numMc) || numMc <= 0) return "—";
                if (numMc >= 1000000)
                  return `$${(numMc / 1000000).toFixed(1)}M`;
                if (numMc >= 1000) return `$${(numMc / 1000).toFixed(1)}K`;
                return `$${numMc.toFixed(0)}`;
              })()}
            </div>
            <div className="text-xs text-art-gray-400">MC</div>
          </div>
          <div
            className="bg-art-gray-50 p-1 md:p-2 rounded-art transform rotate-1"
            style={{ borderRadius: "10px 15px 8px 12px" }}
          >
            <div className="text-sm font-bold text-art-gray-900">
              {(() => {
                const vol = (token as any).volume24h;
                const numVol = Number(vol);
                if (
                  vol === null ||
                  vol === undefined ||
                  !Number.isFinite(numVol) ||
                  numVol <= 0
                )
                  return "—";
                if (numVol >= 1000000)
                  return `$${(numVol / 1000000).toFixed(1)}M`;
                if (numVol >= 1000) return `$${(numVol / 1000).toFixed(1)}K`;
                return `$${numVol.toFixed(0)}`;
              })()}
            </div>
            <div className="text-xs text-art-gray-400">VOL</div>
          </div>
          <div
            className="bg-art-gray-50 p-1 md:p-2 rounded-art transform rotate-0.5"
            style={{ borderRadius: "12px 6px 18px 10px" }}
          >
            <div className="text-sm font-bold text-art-gray-900">
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
            <div className="text-xs text-art-gray-400">HOLDERS</div>
          </div>
        </div>
      </div>

      {/* Hand-drawn decoration */}
    </article>
  );
}

export default React.memo(TokenCard);
