import { useEffect, useState } from "react";
import { getCoinSwaps } from "@zoralabs/coins-sdk";
import { formatUnits } from "viem";

interface SwapActivity {
  id: string;
  type: "BUY" | "SELL";
  amount: string;
  priceUsdc: string;
  timestamp: string;
  txHash: string;
  user: {
    handle?: string;
    address: string;
    avatar?: string;
  };
}

interface RecentTradesProps {
  tokenAddress: string;
  decimals?: number;
}

export function RecentTrades({
  tokenAddress,
  decimals = 18,
}: RecentTradesProps) {
  const [trades, setTrades] = useState<SwapActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrades() {
      try {
        setIsLoading(true);

        const response = await getCoinSwaps({
          address: tokenAddress,
          chain: 8453,
          first: 50,
        });

        if (!response.data?.zora20Token?.swapActivities?.edges) {
          setTrades([]);
          setIsLoading(false);
          return;
        }

        const swaps = response.data.zora20Token.swapActivities.edges;

        const formattedTrades: SwapActivity[] = swaps.map(({ node }) => ({
          id: node.id,
          type: node.activityType as "BUY" | "SELL",
          amount: node.coinAmount,
          priceUsdc: node.currencyAmountWithPrice?.priceUsdc || "0",
          timestamp: node.blockTimestamp,
          txHash: node.transactionHash,
          user: {
            handle: node.senderProfile?.handle,
            address: node.senderAddress,
            avatar: node.senderProfile?.avatar?.previewImage?.small,
          },
        }));

        setTrades(formattedTrades);
        setError(null);
      } catch (err) {
        console.error("Error fetching trades:", err);
        setError("Failed to load recent trades");
      } finally {
        setIsLoading(false);
      }
    }

    fetchTrades();
    const interval = setInterval(fetchTrades, 10000);
    return () => clearInterval(interval);
  }, [tokenAddress]);

  if (isLoading && trades.length === 0) {
    return (
      <div className="p-8 text-center text-art-gray-500">Loading trades...</div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  const displayedTrades = showAll ? trades : trades.slice(0, 5);

  return (
    <div className="space-y-3">
      {trades.length === 0 ? (
        <div className="p-8 text-center text-art-gray-500">No trades found</div>
      ) : (
        <>
          <div className="space-y-2 max-h-[300px] md:max-h-[600px] overflow-y-auto">
            {displayedTrades.map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between p-2 md:p-3 bg-white rounded-art border border-art-gray-200 hover:border-art-gray-300 transition-colors"
                style={{ borderRadius: "12px 8px 10px 6px" }}
              >
                <div className="flex items-center space-x-2 md:space-x-3">
                  {/* Avatar */}
                  {trade.user.avatar ? (
                    <img
                      src={trade.user.avatar}
                      alt={trade.user.handle || "User"}
                      className="w-6 h-6 md:w-8 md:h-8 rounded-full object-cover border border-art-gray-200"
                    />
                  ) : (
                    <div
                      className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center border ${
                        trade.type === "BUY"
                          ? "bg-green-50 border-green-200 text-green-600"
                          : "bg-red-50 border-red-200 text-red-600"
                      }`}
                    >
                      <span className="text-[10px] md:text-xs font-bold">
                        {trade.user.handle
                          ? trade.user.handle[0].toUpperCase()
                          : "U"}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col">
                    <div className="flex items-center space-x-1.5 md:space-x-2">
                      <span className="text-xs md:text-sm font-bold text-art-gray-900">
                        {trade.user.handle ||
                          `${trade.user.address.slice(
                            0,
                            4
                          )}...${trade.user.address.slice(-4)}`}
                      </span>
                      <span
                        className={`text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          trade.type === "BUY"
                            ? "bg-green-50 border-green-200 text-green-700"
                            : "bg-red-50 border-red-200 text-red-700"
                        }`}
                      >
                        {trade.type}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 text-[10px] md:text-xs text-art-gray-500">
                      <span>{formatTokenAmount(trade.amount, decimals)}</span>
                      <span>•</span>
                      <span>${parseFloat(trade.priceUsdc).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 md:space-x-3">
                  <span
                    className="text-[10px] md:text-xs text-art-gray-400 font-medium cursor-help"
                    title={new Date(trade.timestamp).toUTCString()}
                  >
                    {getTimeAgo(trade.timestamp)}
                  </span>
                  <a
                    href={`https://basescan.org/tx/${trade.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-art-gray-400 hover:text-art-gray-600 transition-colors"
                    title="View on Basescan"
                  >
                    <svg
                      className="w-3 h-3 md:w-4 md:h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </div>
              </div>
            ))}
          </div>

          {trades.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full mt-4 hand-drawn-btn text-sm font-bold py-2 text-art-gray-600 hover:text-art-gray-900"
              style={{ transform: "rotate(-0.3deg)" }}
            >
              {showAll ? "Show Less" : `View All Trades (${trades.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Helper function to get time ago string
function getTimeAgo(timestamp: string): string {
  const now = Date.now();
  let time: number;

  // Check if timestamp is a unix timestamp (digits only)
  if (/^\d+$/.test(timestamp)) {
    time = parseInt(timestamp) * 1000;
  } else {
    // Assume ISO string. If it doesn't end in Z, append it to force UTC
    // This fixes the issue where timestamps without 'Z' are treated as local time
    const timeStr = timestamp.endsWith("Z") ? timestamp : `${timestamp}Z`;
    time = new Date(timeStr).getTime();
  }

  const diff = now - time;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

function formatTokenAmount(amount: string, decimals: number): string {
  const value = parseFloat(formatUnits(BigInt(amount), decimals));

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}K`;
  }
  return value.toFixed(4);
}
