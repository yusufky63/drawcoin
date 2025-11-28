import React from "react";
import { useRouter } from "next/navigation";
import { useWatchlist } from "../../hooks/useWatchlist";
import { SafeImage } from "../ui/SafeImage";

interface Token {
  contract_address: string;
  name: string;
  symbol: string;
  image_url: string;
  holders: number;
  watchlist_count?: number;
  current_price?: number;
  market_cap?: number;
  price_change_24h?: number;
  volume_24h?: number;
  creation_type?: "ai" | "hand-drawn";
}

interface ExploreSectionProps {
  title: string;
  tokens: Token[];
  type?: "watchlist" | "ai" | "hand-drawn";
}

export default function ExploreSection({
  title,
  tokens,
}: ExploreSectionProps) {
  const { watchlist, toggleWatchlist } = useWatchlist();
  const router = useRouter();
  const watchlistSet = new Set(watchlist.map((a) => a.toLowerCase()));

  if (!tokens || tokens.length === 0) return null;

  function renderTokenRow(
    token: Token,
    index: number,
    isMobileHidden: boolean = false
  ) {
    const isFavorite = watchlistSet.has(token.contract_address.toLowerCase());

    return (
      <div
        key={token.contract_address}
        className={`group relative p-3 items-center gap-3 hover:bg-blue-50/30 transition-colors cursor-pointer ${
          isMobileHidden ? "hidden md:flex" : "flex"
        }`}
        onClick={() => router.push(`/coin/${token.contract_address}`)}
      >
        {/* Rank */}
        <div className="w-6 text-center font-black text-art-gray-300 text-lg italic">
          {index + 1}
        </div>

        {/* Image */}
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

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-black text-sm text-art-gray-900 truncate group-hover:text-blue-600 transition-colors max-w-[100px]">
              {token.name}
            </h4>
            <span className="text-[10px] font-bold text-art-gray-500 font-mono bg-art-gray-100 px-1 rounded border border-art-gray-200">
              ${token.symbol}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            {/* MC */}
            <span className="text-[10px] font-black text-art-gray-600">
              MC: $
              {(token.market_cap || 0) >= 1000000
                ? ((token.market_cap || 0) / 1000000).toFixed(1) + "M"
                : ((token.market_cap || 0) / 1000).toFixed(1) + "K"}
            </span>

            {/* VOL */}
            <span className="text-[10px] font-black text-art-gray-600  border-art-gray-200 pl-2 hidden sm:inline-block">
              VOL: $
              {(token.volume_24h || 0) >= 1000000
                ? ((token.volume_24h || 0) / 1000000).toFixed(1) + "M"
                : ((token.volume_24h || 0) / 1000).toFixed(1) + "K"}
            </span>

            {/* Holders */}
            <span className="text-[10px] font-black text-art-gray-600  border-art-gray-200 pl-2">
              Holders: {token.holders || 0}
            </span>
          </div>
        </div>

        {/* Action */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleWatchlist(token.contract_address);
          }}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-full transition-colors ${
            isFavorite ? "text-red-500" : "text-art-gray-400 hover:text-red-400"
          }`}
        >
          <svg
            className={`w-5 h-5 ${isFavorite ? "fill-current" : "fill-none"}`}
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
    );
  }

  return (
    <div className="hand-drawn-card p-0 overflow-hidden bg-white mb-8">
      {/* Header */}
      <div className="p-4 border-b-2 border-art-gray-100 bg-art-gray-50 flex items-center justify-between">
        <h3 className="text-lg font-black text-art-gray-900 uppercase tracking-wider flex items-center gap-2">
          {title}
        </h3>
        <button
          onClick={() => router.push("/most-watchlisted")}
          className="text-xs font-bold text-art-gray-400 hover:text-art-gray-900 uppercase tracking-widest transition-colors hover:underline"
        >
          View Full →
        </button>
      </div>

      {/* List Rows - 2 Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0 divide-y md:divide-y-0 md:divide-x-2 divide-art-gray-100/50">
        {/* Column 1: 1-5 */}
        <div className="divide-y-2 divide-art-gray-100/50">
          {tokens
            .slice(0, 5)
            .map((token, index) => renderTokenRow(token, index, index >= 3))}
        </div>

        {/* Column 2: 6-10 (Hidden on Mobile) */}
        <div className="hidden md:block divide-y-2 divide-art-gray-100/50 border-t-2 md:border-t-0 border-art-gray-100/50">
          {tokens
            .slice(5, 10)
            .map((token, index) => renderTokenRow(token, index + 5))}
        </div>
      </div>
    </div>
  );
}
