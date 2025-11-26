"use client";
import React, { useState, useEffect, useRef } from "react";
import { Coin } from "../../../lib/supabase";

interface CoinSummaryCardProps {
  token: Coin;
  marketData: any;
}

interface FarcasterUser {
  username?: string;
  displayName?: string;
  fid?: number;
  pfpUrl?: string;
}

export const CoinSummaryCard: React.FC<CoinSummaryCardProps> = ({
  token,
  marketData,
}) => {
  const [creatorFarcaster, setCreatorFarcaster] =
    useState<FarcasterUser | null>(null);

  // Track the last address we fetched to prevent redundant calls
  const lastFetchedAddress = useRef<string | null>(null);

  // Resolve Creator Address (handle both camelCase and snake_case)
  const creatorAddress = token.creatorAddress || (token as any).creator_address;

  useEffect(() => {
    // If we have Farcaster data from marketData (Zora API), use it
    if (marketData?.creatorProfile?.socialAccounts?.farcaster) {
      const fc = marketData.creatorProfile.socialAccounts.farcaster;
      setCreatorFarcaster({
        username: fc.username,
        displayName: fc.displayName,
        fid: fc.id ? parseInt(fc.id) : undefined,
      });
      return;
    }

    const fetchCreatorFarcaster = async () => {
      if (!creatorAddress) return;

      // Prevent fetching if we already fetched for this address
      if (lastFetchedAddress.current === creatorAddress) return;

      try {
        lastFetchedAddress.current = creatorAddress; // Mark as fetched immediately

        const response = await fetch(
          `/api/farcaster/user?address=${creatorAddress}`
        );
        const data = await response.json();
        if (data.user) setCreatorFarcaster(data.user);
      } catch (err) {
        console.error("Error fetching creator's Farcaster profile:", err);
      }
    };

    fetchCreatorFarcaster();
  }, [creatorAddress, marketData?.creatorProfile?.socialAccounts?.farcaster]);

  // Resolve Profile Data (Prioritize marketData > token)
  const creatorProfile =
    marketData?.creatorProfile || (token as any).creatorProfile;
  const creatorAvatar =
    creatorProfile?.avatar?.previewImage?.small ||
    token.creator?.avatar?.previewImage?.small;
  const creatorHandle = creatorProfile?.handle;
  // creatorAddress is already resolved above

  return (
    <div className="mb-4">
      {/* Header: Name & Symbol */}
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-bold text-art-gray-900 leading-tight">
          {token.name}
        </h2>
        <span className="text-xs font-bold text-art-gray-500 bg-art-gray-100 px-2 py-1 rounded-full border border-art-gray-200">
          ${token.symbol}
        </span>
      </div>

      {/* Creator Info Row */}
      <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b-2 border-dashed border-art-gray-200">
        <span className="text-xs text-art-gray-500 font-medium">
          Created by
        </span>

        {/* Zora Profile */}
        <a
          href={`https:/zora.co/@${creatorHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full transition-colors group"
        >
          {/* Zora Icon/Avatar */}
          {creatorAvatar ? (
            <img
              src={creatorAvatar}
              alt="Zora"
              className="w-4 h-4 rounded-full"
            />
          ) : (
            <div className="w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-[8px]">
              Z
            </div>
          )}
          <span className="text-xs font-bold text-blue-700 group-hover:text-blue-800">
            {creatorHandle ||
              (creatorAddress ? `${creatorAddress.slice(0, 6)}...` : "Unknown")}
          </span>
        </a>

        {/* Farcaster Profile */}
        {creatorFarcaster && (
          <a
            href={`https://farcaster.xyz/${
              creatorFarcaster.username || creatorFarcaster.fid
            }`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-full transition-colors group"
          >
            <img
              src="https://farcaster.xyz/favicon.ico"
              alt="Farcaster"
              className="w-4 h-4 rounded-full"
            />
            <span className="text-xs font-bold text-purple-700 group-hover:text-purple-800">
              @
              {creatorFarcaster.username ||
                creatorFarcaster.displayName ||
                creatorFarcaster.fid}
            </span>
          </a>
        )}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-[10px] text-art-gray-500 uppercase tracking-wider">
            Market Cap
          </div>
          <div className="text-sm font-bold text-art-gray-900">
            {marketData?.marketCap
              ? `$${parseFloat(marketData.marketCap).toLocaleString()}`
              : "N/A"}
          </div>
        </div>
        <div className="text-center border-l border-r border-art-gray-200 border-dashed">
          <div className="text-[10px] text-art-gray-500 uppercase tracking-wider">
            Volume
          </div>
          <div className="text-sm font-bold text-art-gray-900">
            {marketData?.volume24h
              ? `$${parseFloat(marketData.volume24h).toLocaleString()}`
              : "N/A"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-art-gray-500 uppercase tracking-wider">
            Holders
          </div>
          <div className="text-sm font-bold text-art-gray-900">
            {marketData?.uniqueHolders
              ? marketData.uniqueHolders.toLocaleString()
              : "N/A"}
          </div>
        </div>
      </div>
    </div>
  );
};
