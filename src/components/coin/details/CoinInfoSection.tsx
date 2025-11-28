import React from "react";
import { Coin } from "../../../lib/supabase";
import { Copy } from "lucide-react";
import { formatEther } from "viem";

interface CoinInfoSectionProps {
  token: Coin;
  marketData: any;
  poolAddress?: string | null;
}

export const CoinInfoSection: React.FC<CoinInfoSectionProps> = ({
  token,
  marketData,
  poolAddress,
}) => {
  return (
    <div className="mt-2">
      <div className="hand-drawn-card">
        <div className="p-4">
          <h2 className="text-xl font-bold text-art-gray-900 mb-4 transform -rotate-1">
            Token Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Basic Info */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-art-gray-900">
                Basic Information
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-art-gray-600">Name:</span>
                  <span className="text-sm font-bold text-art-gray-900">
                    {token.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-art-gray-600">Symbol:</span>
                  <span className="text-sm font-bold text-art-gray-900">
                    {token.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-art-gray-600">Contract:</span>
                  <span className="text-sm font-mono text-art-gray-700 flex items-center">
                    <Copy
                      className="w-4 h-4 mr-2 cursor-pointer"
                      onClick={() =>
                        navigator.clipboard.writeText(token.contract_address)
                      }
                    />
                    <a
                      href={`https://basescan.org/address/${token.contract_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer"
                    >
                      {token.contract_address?.substring(0, 6)}...
                      {token.contract_address?.substring(
                        token.contract_address.length - 4
                      )}
                    </a>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-art-gray-600">Creator:</span>
                  <div className="flex items-center space-x-2">
                    {token.creator?.avatar?.previewImage?.small && (
                      <img
                        src={token.creator.avatar.previewImage.small}
                        alt="Creator"
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    <span className="text-sm font-mono text-art-gray-700 flex items-center">
                      <Copy
                        className="w-4 h-4 mr-2 cursor-pointer"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            token.creatorAddress || ""
                          )
                        }
                      />
                      <a
                        className=" cursor-pointer hover:text-blue-500"
                        href={`https://basescan.org/address/${token.creatorAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {token.creator?.creatorProfile?.avatar
                          ? token.creator?.handle
                          : token?.creatorAddress?.substring(0, 6) +
                            "..." +
                            token?.creatorAddress?.substring(
                              token?.creatorAddress.length - 4
                            )}
                      </a>
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-art-gray-600">Created:</span>
                  <span className="text-sm font-bold text-art-gray-900">
                    {marketData?.createdAt
                      ? new Date(marketData.createdAt).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-art-gray-600">
                    Total Supply:
                  </span>
                  <span className="text-sm font-bold text-art-gray-900">
                    {(() => {
                      const supply = marketData?.totalSupply;
                      if (!supply) return "N/A";
                      // Check if it's a large number (likely wei)
                      if (supply.length > 18) {
                        return parseFloat(
                          formatEther(BigInt(supply))
                        ).toLocaleString();
                      }
                      return parseFloat(supply).toLocaleString();
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Market Data */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-art-gray-900">
                Market Data
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-art-gray-600">Price:</span>
                  <span className="text-sm font-bold text-art-gray-900">
                    {marketData?.tokenPrice?.priceInUsdc
                      ? `$${parseFloat(
                          marketData.tokenPrice.priceInUsdc
                        ).toFixed(8)}`
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-art-gray-600">Market Cap:</span>
                  <span className="text-sm font-bold text-art-gray-900">
                    {marketData?.marketCap
                      ? `$${parseFloat(marketData.marketCap).toLocaleString()}`
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-art-gray-600">24h Volume:</span>
                  <span className="text-sm font-bold text-art-gray-900">
                    {marketData?.volume24h
                      ? `$${parseFloat(marketData.volume24h).toLocaleString()}`
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-art-gray-600">
                    Total Volume:
                  </span>
                  <span className="text-sm font-bold text-art-gray-900">
                    {marketData?.totalVolume
                      ? `$${parseFloat(
                          marketData.totalVolume
                        ).toLocaleString()}`
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-art-gray-600">Holders:</span>
                  <span className="text-sm font-bold text-art-gray-900">
                    {marketData?.uniqueHolders
                      ? marketData.uniqueHolders.toLocaleString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-art-gray-600">24h Change:</span>
                  <span
                    className={`text-sm font-bold ${(() => {
                      const marketCap = parseFloat(marketData?.marketCap);
                      const delta24h = parseFloat(
                        marketData?.marketCapDelta24h
                      );
                      if (marketCap && delta24h) {
                        // If delta24h equals marketCap, it means it's a new token (100% change)
                        if (marketCap === delta24h) {
                          return "text-green-600"; // New token, positive
                        }
                        // Calculate percentage change
                        const previousMC = marketCap - delta24h;
                        if (previousMC > 0) {
                          const changePct = (delta24h / previousMC) * 100;
                          return changePct > 0
                            ? "text-green-600"
                            : "text-red-600";
                        }
                      }
                      return "text-gray-600";
                    })()}`}
                  >
                    {(() => {
                      const marketCap = parseFloat(marketData?.marketCap);
                      const delta24h = parseFloat(
                        marketData?.marketCapDelta24h
                      );
                      if (marketCap && delta24h) {
                        // If delta24h equals marketCap, it's a new token
                        if (marketCap === delta24h) {
                          return "+100.00%"; // New token
                        }
                        // Calculate percentage change
                        const previousMC = marketCap - delta24h;
                        if (previousMC > 0) {
                          const changePct = (delta24h / previousMC) * 100;
                          return `${
                            changePct > 0 ? "+" : ""
                          }${changePct.toFixed(2)}%`;
                        }
                      }
                      return "N/A";
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Onchain Data */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-art-gray-900">
                Onchain Data
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  Pool Address:
                  <span className="text-sm font-mono text-art-gray-700">
                    {poolAddress ? (
                      <a
                        href={`https://app.uniswap.org/explore/pools/base/${poolAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 transition-colors"
                      >
                        {poolAddress?.slice(0, 6)}... {poolAddress?.slice(-4)}
                      </a>
                    ) : (
                      "N/A"
                    )}
                  </span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-art-gray-600">Pair:</span>
                <span className="text-sm font-bold text-art-gray-900">
                  {marketData?.poolCurrencyToken?.name
                    ? `${token.symbol} / ${marketData.poolCurrencyToken.name}`
                    : "N/A"}
                </span>
              </div>
              {marketData?.liquidity && (
                <div className="flex justify-between">
                  <span className="text-sm text-art-gray-600">Liquidity:</span>
                  <span className="text-sm font-bold text-art-gray-900">
                    {(() => {
                      const liq = marketData.liquidity;
                      if (liq.length > 18) {
                        return `$${parseFloat(
                          formatEther(BigInt(liq))
                        ).toLocaleString()}`;
                      }
                      return `$${parseFloat(liq).toLocaleString()}`;
                    })()}
                  </span>
                </div>
              )}
              {marketData?.chainId && (
                <div className="flex justify-between">
                  <span className="text-sm text-art-gray-600">Network:</span>
                  <span className="text-sm font-bold text-art-gray-900">
                    Base
                  </span>
                </div>
              )}
              {marketData?.uniswapV4PoolKey?.fee && (
                <div className="flex justify-between">
                  <span className="text-sm text-art-gray-600">Pool Fee:</span>
                  <span className="text-sm font-bold text-art-gray-900">
                    {(marketData.uniswapV4PoolKey.fee / 10000).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {token.description && (
          <div className="mt-6">
            <h3 className="text-lg font-bold text-art-gray-900 mb-2">
              Description
            </h3>
            <p className="text-sm text-art-gray-700 leading-relaxed">
              {token.description}
            </p>
          </div>
        )}

        {/* Links */}
        <div className="mt-6 flex space-x-4">
          <a
            href={`https://zora.co/coin/base:${token.contract_address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hand-drawn-btn text-sm font-bold px-4 py-2 transform rotate-1"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "8px 3px 6px 4px",
            }}
          >
            View on Zora
          </a>
          <a
            href={`https://dexscreener.com/base/${token.contract_address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hand-drawn-btn text-sm font-bold px-4 py-2 transform -rotate-1"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "6px 4px 8px 3px",
            }}
          >
            View on DexScreener
          </a>
        </div>
      </div>
    </div>
  );
};
