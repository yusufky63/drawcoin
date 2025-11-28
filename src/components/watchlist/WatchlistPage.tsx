"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWatchlist } from "../../hooks/useWatchlist";
import { CoinService, Coin } from "../../services/coinService";
import { useAccount } from "wagmi";
import { resolveImageUrl, getImageFromIpfsMetadata } from "../../utils/ipfs";
import { getCoinsBatchWithRetry } from "../../services/zoraService";
import HandDrawnSkeleton from "../ui/HandDrawnSkeleton";

interface WatchlistTokenData extends Coin {
  added_at?: string;
  added_price_eth?: number | string | null;
  added_price_usd?: number | string | null;
  added_price_timestamp?: string | null;
}

export default function WatchlistPage() {
  const {
    watchlist,
    watchlistItems,
    loading: watchlistLoading,
    toggleWatchlist,
  } = useWatchlist();
  const router = useRouter();
  const [tokens, setTokens] = useState<WatchlistTokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const { isConnected } = useAccount();
  const [resolvedImages, setResolvedImages] = useState<Record<string, string>>(
    {}
  );
  const parsePriceValue = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === "number" ? value : parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const formatPriceLabel = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) return "-";
    if (value >= 1) return `$${value.toFixed(2)}`;
    if (value >= 0.01) return `$${value.toFixed(4)}`;
    return `$${value.toFixed(6)}`;
  };
  const getWatchlistChangeMeta = (token: WatchlistTokenData) => {
    const addedPrice = parsePriceValue(token?.added_price_usd);
    const currentPrice = parsePriceValue(
      (token as any)?.tokenPrice?.priceInUsdc ??
        (token as any)?.tokenPrice?.priceInUsd ??
        token?.current_price ??
        (token as any)?.current_price
    );
    if (addedPrice === null || addedPrice <= 0 || currentPrice === null) {
      return { diffPct: null, addedPrice };
    }
    const diffPct = ((currentPrice - addedPrice) / addedPrice) * 100;
    return { diffPct, addedPrice };
  };

  useEffect(() => {
    const fetchTokens = async () => {
      console.log("🔍 Watchlist Page - Starting fetch:", {
        watchlistLength: watchlist.length,
        watchlistItemsLength: watchlistItems.length,
        watchlist,
        watchlistItems,
      });

      if (watchlist.length === 0) {
        console.log("⚠️ Watchlist is empty");
        setTokens([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log("🔄 Fetching token details in batch from Zora API...");

        // Fetch Zora data in batches (20 tokens per request)
        let zoraDataMap: Record<string, any> = {};
        try {
          zoraDataMap = await getCoinsBatchWithRetry(watchlist);
          console.log("📦 Zora batch data:", zoraDataMap);
        } catch (error) {
          console.warn(
            "⚠️ Zora batch fetch failed, will use Supabase data only:",
            error
          );
        }

        // Fetch Supabase data for static info (image_url, description)
        const dbPromises = watchlist.map((address) =>
          CoinService.getCoinByAddress(address)
        );
        const dbTokens = await Promise.all(dbPromises);
        console.log("📦 Supabase data:", dbTokens);

        // Merge Zora (live) + Supabase (static)
        const mergedTokens = watchlist.map((address, index) => {
          const dbData = dbTokens[index];
          const zoraData = zoraDataMap[address.toLowerCase()];

          if (!dbData && !zoraData) return null;

          return {
            ...dbData,
            ...zoraData,
            contract_address: address,
            // Keep image_url from DB for IPFS resolution
            image_url: dbData?.image_url || zoraData?.tokenUri,
            // Keep name/symbol from DB if Zora doesn't have it
            name: zoraData?.name || dbData?.name,
            symbol: zoraData?.symbol || dbData?.symbol,
          };
        });

        const validTokens = mergedTokens.filter((t) => t !== null);
        console.log("✅ Merged tokens:", validTokens);

        // Merge with watchlist items to get added_at and price snapshot
        const tokensWithAddedAt = validTokens.map((token) => {
          const watchlistItem = watchlistItems.find(
            (item) =>
              item.token_address.toLowerCase() ===
              token.contract_address.toLowerCase()
          );
          return {
            ...token,
            added_at: watchlistItem?.added_at,
            added_price_eth: watchlistItem?.added_price_eth,
            added_price_usd: watchlistItem?.added_price_usd,
            added_price_timestamp: watchlistItem?.added_price_timestamp,
          };
        });

        console.log("🎯 Final tokens with metadata:", tokensWithAddedAt);
        setTokens(tokensWithAddedAt);

        // Resolve IPFS images
        tokensWithAddedAt.forEach(async (token) => {
          const imageUrl =
            (token as any).mediaContent?.previewImage?.small || token.image_url;
          if (imageUrl && imageUrl.startsWith("ipfs://")) {
            try {
              const resolved = await getImageFromIpfsMetadata(imageUrl);
              if (resolved) {
                setResolvedImages((prev) => ({
                  ...prev,
                  [token.contract_address]: resolved,
                }));
              }
            } catch (err) {
              console.warn(
                "Failed to resolve IPFS image for",
                token.contract_address,
                err
              );
            }
          }
        });
      } catch (error) {
        console.error("💥 Error fetching watchlist tokens:", error);
        setTokens([]);
      } finally {
        setLoading(false);
      }
    };

    if (!watchlistLoading) {
      fetchTokens();
    }
  }, [watchlist, watchlistItems, watchlistLoading]);

  const formatNumber = (num: string | number | undefined) => {
    if (!num) return "0";
    const value = typeof num === "string" ? parseFloat(num) : num;
    if (value >= 1000000) return (value / 1000000).toFixed(2) + "M";
    if (value >= 1000) return (value / 1000).toFixed(2) + "K";
    return value.toFixed(2);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-art-gray-50 flex items-center justify-center p-4">
        <div className="hand-drawn-card max-w-md w-full text-center">
          <div className="hand-drawn-header justify-center mb-4">
            <h2 className="text-xl">Watchlist</h2>
          </div>
          <p className="text-art-gray-600 mb-6">
            Connect your wallet to view your favorite tokens.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-art-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="hand-drawn-header mb-6">
          <h1 className="text-2xl font-bold text-art-gray-900">
            Your Watchlist
          </h1>
          <p className="text-sm text-art-gray-600 mt-1">
            {" "}
            ({tokens.length} tokens){" "}
          </p>
        </div>
        {loading || watchlistLoading ? (
          <div className="space-y-6">
            {/* Desktop Skeleton */}
            <div className="hidden md:block">
              <div className="hand-drawn-card p-6">
                <HandDrawnSkeleton variant="table" count={5} />
              </div>
            </div>
            {/* Mobile Skeleton */}
            <div className="md:hidden space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="hand-drawn-card p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <HandDrawnSkeleton variant="circle" className="w-12 h-12" />
                    <div className="space-y-2 flex-1">
                      <HandDrawnSkeleton variant="text" className="w-1/2 h-4" />
                      <HandDrawnSkeleton variant="text" className="w-1/4 h-3" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <HandDrawnSkeleton variant="text" className="w-full h-8" />
                    <HandDrawnSkeleton variant="text" className="w-full h-8" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : tokens.length === 0 ? (
          <div className="hand-drawn-card text-center py-12">
            <svg
              className="w-16 h-16 text-art-gray-300 mx-auto mb-4"
              fill="none"
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
            <p className="text-art-gray-600 font-bold mb-2">
              Your watchlist is empty
            </p>
            <p className="text-sm text-art-gray-500">
              Heart tokens from the market to track them here!
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 hand-drawn-btn px-6 py-2"
            >
              Browse Tokens
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block hand-drawn-card overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-art-gray-900">
                    <th className="text-left p-3 text-sm font-bold text-art-gray-900">
                      Token
                    </th>
                    <th className="text-right p-3 text-sm font-bold text-art-gray-900">
                      MC
                    </th>
                    <th className="text-right p-3 text-sm font-bold text-art-gray-900">
                      VOL
                    </th>
                    <th className="text-right p-3 text-sm font-bold text-art-gray-900">
                      24h %
                    </th>
                    <th className="text-right p-3 text-sm font-bold text-art-gray-900">
                      Since Added
                    </th>
                    <th className="text-center p-3 text-sm font-bold text-art-gray-900">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => {
                    const changeMeta = getWatchlistChangeMeta(token);
                    return (
                      <tr
                        key={token.contract_address}
                        className="border-b border-art-gray-200 hover:bg-art-gray-50 transition-colors cursor-pointer"
                        onClick={() =>
                          router.push(`/coin/${token.contract_address}`)
                        }
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {(() => {
                              const imageUrl =
                                (token as any).mediaContent?.previewImage
                                  ?.small || token.image_url;
                              const resolvedUrl =
                                resolvedImages[token.contract_address] ||
                                (imageUrl ? resolveImageUrl(imageUrl) : "");

                              return resolvedUrl ? (
                                <img
                                  src={resolvedUrl}
                                  alt={token.name}
                                  className="w-10 h-10 rounded-full border-2 border-art-gray-900 object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              ) : null;
                            })()}
                            <div>
                              <div className="font-bold text-art-gray-900">
                                {token.name}
                              </div>
                              <div className="text-xs text-art-gray-500">
                                {token.symbol}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-right text-sm">
                          ${formatNumber(token.marketCap)}
                        </td>
                        <td className="p-3 text-right text-sm">
                          $
                          {formatNumber(
                            token.volume_24h || (token as any).totalVolume
                          )}
                        </td>
                        <td
                          className={`p-3 text-right text-sm font-bold ${(() => {
                            const val =
                              typeof (token as any).marketCapDelta24h ===
                              "number"
                                ? (token as any).marketCapDelta24h
                                : parseFloat(
                                    (token as any).marketCapDelta24h || "0"
                                  );
                            return val >= 0 ? "text-green-600" : "text-red-600";
                          })()}`}
                        >
                          {(() => {
                            const change =
                              typeof (token as any).marketCapDelta24h ===
                              "number"
                                ? (token as any).marketCapDelta24h
                                : parseFloat(
                                    (token as any).marketCapDelta24h || "0"
                                  );
                            return change >= 0
                              ? `+${change.toFixed(2)}%`
                              : `${change.toFixed(2)}%`;
                          })()}
                        </td>
                        <td className="p-3 text-right">
                          {changeMeta.diffPct !== null ? (
                            <>
                              <div
                                className={` text-sm font-bold ${
                                  changeMeta.diffPct >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {changeMeta.diffPct >= 0 ? "+" : ""}
                                {changeMeta.diffPct.toFixed(2)}%
                              </div>
                              <div className="text-xs text-art-gray-500">
                                @ {formatPriceLabel(changeMeta.addedPrice)}
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-art-gray-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWatchlist(token.contract_address);
                            }}
                            className="p-2 rounded-full text-red-500 hover:bg-red-50 transition-colors"
                            title="Remove from watchlist"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {tokens.map((token) => {
                const changeMeta = getWatchlistChangeMeta(token);
                return (
                  <div
                    key={token.contract_address}
                    className="hand-drawn-card p-3 cursor-pointer hover:scale-[1.02] transition-transform"
                    onClick={() =>
                      router.push(`/coin/${token.contract_address}`)
                    }
                  >
                    <div className="flex items-start gap-3 mb-3">
                      {(() => {
                        const imageUrl =
                          (token as any).mediaContent?.previewImage?.small ||
                          token.image_url;
                        const resolvedUrl =
                          resolvedImages[token.contract_address] ||
                          (imageUrl ? resolveImageUrl(imageUrl) : "");

                        return resolvedUrl ? (
                          <img
                            src={resolvedUrl}
                            alt={token.name}
                            className="w-12 h-12 rounded-full border-2 border-art-gray-900 flex-shrink-0 object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null;
                      })()}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-art-gray-900 truncate text-lg">
                              {token.name}
                            </div>
                            <div className="text-sm text-art-gray-500 font-medium">
                              {token.symbol}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWatchlist(token.contract_address);
                            }}
                            className="p-2 rounded-full text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                            title="Remove"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm bg-art-gray-50 p-2 rounded-lg border border-art-gray-200 border-dashed">
                      <div className="text-center">
                        <div className="text-[10px] text-art-gray-500 mb-1">
                          MC
                        </div>
                        <div className="font-bold text-art-gray-900 text-xs">
                          ${formatNumber(token.marketCap)}
                        </div>
                      </div>
                      <div className="text-center border-l border-r border-art-gray-200 border-dashed px-1">
                        <div className="text-[10px] text-art-gray-500 mb-1">
                          VOL
                        </div>
                        <div className="font-bold text-art-gray-900 text-xs">
                          $
                          {formatNumber(
                            token.volume_24h || (token as any).totalVolume
                          )}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-art-gray-500 mb-1">
                          24h %
                        </div>
                        <div
                          className={`font-bold text-xs ${(() => {
                            const val =
                              typeof (token as any).marketCapDelta24h ===
                              "number"
                                ? (token as any).marketCapDelta24h
                                : parseFloat(
                                    (token as any).marketCapDelta24h || "0"
                                  );
                            return val >= 0 ? "text-green-600" : "text-red-600";
                          })()}`}
                        >
                          {(() => {
                            const change =
                              typeof (token as any).marketCapDelta24h ===
                              "number"
                                ? (token as any).marketCapDelta24h
                                : parseFloat(
                                    (token as any).marketCapDelta24h || "0"
                                  );
                            return change >= 0
                              ? `+${change.toFixed(1)}%`
                              : `${change.toFixed(1)}%`;
                          })()}
                        </div>
                      </div>
                    </div>

                    {changeMeta.diffPct !== null && (
                      <div className="mt-2 pt-2 border-t-2 border-dashed border-art-gray-200">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-art-gray-500 font-medium">
                            Since Added:
                          </span>
                          <div className="text-right flex items-center gap-2">
                            <div
                              className={`font-bold ${
                                changeMeta.diffPct >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {changeMeta.diffPct >= 0 ? "+" : ""}
                              {changeMeta.diffPct.toFixed(2)}%
                            </div>
                            <div className="text-art-gray-400 text-[10px]">
                              (@ {formatPriceLabel(changeMeta.addedPrice)})
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
