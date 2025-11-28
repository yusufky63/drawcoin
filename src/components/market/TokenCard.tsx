import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Coin } from "../../lib/supabase";
import { WatchlistPriceHint } from "../../hooks/useWatchlist";
import { SafeImage } from "../ui/SafeImage";

interface TokenCardProps {
  token: Coin;
  onTrade: (token: Coin) => void;
  onView: (token: Coin) => void;
  showBalance?: boolean; // Optional prop to show user balance
  watchlistSet?: Set<string>; // Pre-computed Set for O(1) lookup
  onToggleWatchlist?: (
    tokenAddress: string,
    priceHint?: WatchlistPriceHint
  ) => void; // Callback from parent
  watchlistCount?: number; // NEW: Watchlist count
  onCreatorClick?: (creatorAddress: string) => void; // NEW: Callback for creator click
}

export function TokenCard({
  token,
  onTrade,
  showBalance = false,
  watchlistSet,
  onToggleWatchlist,
  watchlistCount,
  onCreatorClick,
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

  const router = useRouter();

  const handleCardClick = () => {
    // Navigate to coin detail page
    router.push(`/coin/${token.contract_address}`);
  };

  const handleTradeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTrade(token);
  };

  const handleViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/coin/${token.contract_address}`);
  };

  return (
    <div
      className="hand-drawn-card group cursor-pointer relative"
      onClick={handleCardClick}
      style={{ transform: "rotate(-0.5deg)" }}
    >
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
        onClick={(e) => {
          e.stopPropagation();
          if (onToggleWatchlist) {
            onToggleWatchlist(token.contract_address, watchlistPriceHint);
          }
        }}
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
      {token.creation_type && (
        <div
          className="absolute top-3 left-3 z-30 px-2 py-0.5 rounded-full text-[10px] font-bold border-2 border-art-gray-900 bg-white/90 text-art-gray-900 shadow-sm"
          style={{ borderRadius: "12px 8px 12px 8px" }}
        >
          {token.creation_type === "ai" ? "AI Generated" : "Hand Drawn"}
        </div>
      )}

      {/* Hover Overlay with Buttons */}
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 overflow-hidden rounded-art">
        <div className="flex gap-3">
          <button
            onClick={handleViewClick}
            className="hand-drawn-btn text-sm font-bold py-3 px-6 transform -rotate-1 hover:scale-105 transition-transform duration-200"
            style={{
              borderRadius: "12px 4px 8px 6px",
              backgroundColor: "#4299e1",
              minWidth: "80px",
            }}
          >
            View
          </button>
          <button
            onClick={handleTradeClick}
            className="hand-drawn-btn text-sm font-bold py-3 px-6 transform rotate-1 hover:scale-105 transition-transform duration-200"
            style={{
              borderRadius: "8px 6px 12px 4px",
              backgroundColor: "#48bb78",
              minWidth: "80px",
            }}
          >
            Trade
          </button>
        </div>
      </div>
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
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <h3 className="font-bold text-art-gray-900 text-sm leading-tight truncate transform rotate-0.5">
                {(token as any).name || token.name}
              </h3>
              <p className="text-[10px] text-art-gray-500 font-mono bg-art-gray-100 px-1 py-0.5 rounded-art transform -rotate-1">
                {(token as any).symbol || token.symbol}
              </p>
            </div>
            <div
              className={`text-[12px] font-bold ${(() => {
                const priceChange = (token as any).marketCapDelta24h;
                if (priceChange && parseFloat(priceChange) > 0)
                  return "text-green-600";
                if (priceChange && parseFloat(priceChange) < 0)
                  return "text-red-600";
                return "text-art-gray-900";
              })()}`}
            >
              {(() => {
                const priceChange = (token as any).marketCapDelta24h;
                return priceChange
                  ? `${parseFloat(priceChange) >= 0 ? "+" : ""}${parseFloat(
                      priceChange
                    ).toFixed(2)}%`
                  : "0.00%";
              })()}
            </div>
          </div>
          {(token as any).creatorProfile?.handle && (
            <p
              className="text-[11px] text-art-gray-500 truncate transform -rotate-0.5 hover:text-blue-500 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                if (onCreatorClick && token.creator_address) {
                  onCreatorClick(token.creator_address);
                }
              }}
            >
              by {(token as any).creatorProfile.handle}
            </p>
          )}
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
              $
              {(() => {
                const mc = (token as any).marketCap;
                if (!mc) return "0";
                const numMc = parseFloat(mc);
                if (numMc >= 1000000) return (numMc / 1000000).toFixed(1) + "M";
                if (numMc >= 1000) return (numMc / 1000).toFixed(1) + "K";
                return numMc.toFixed(0);
              })()}
            </div>
            <div className="text-xs text-art-gray-400">MC</div>
          </div>
          <div
            className="bg-art-gray-50 p-1 md:p-2 rounded-art transform rotate-1"
            style={{ borderRadius: "10px 15px 8px 12px" }}
          >
            <div className="text-sm font-bold text-art-gray-900">
              $
              {(() => {
                const vol =
                  (token as any).volume24h || (token as any).totalVolume;
                if (!vol) return "0";
                const numVol = parseFloat(vol);
                if (numVol >= 1000000)
                  return (numVol / 1000000).toFixed(1) + "M";
                if (numVol >= 1000) return (numVol / 1000).toFixed(1) + "K";
                return numVol.toFixed(0);
              })()}
            </div>
            <div className="text-xs text-art-gray-400">VOL</div>
          </div>
          <div
            className="bg-art-gray-50 p-1 md:p-2 rounded-art transform rotate-0.5"
            style={{ borderRadius: "12px 6px 18px 10px" }}
          >
            <div className="text-sm font-bold text-art-gray-900">
              {(token as any).holders || 0}
            </div>
            <div className="text-xs text-art-gray-400">HOLDERS</div>
          </div>
        </div>
      </div>

      {/* Hand-drawn decoration */}
    </div>
  );
}

export default React.memo(TokenCard);
