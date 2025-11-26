"use client";
import { useState, useEffect } from "react";
import { SafeImage } from "../ui/SafeImage";
import { supabase } from "@/lib/supabase";

export default function TokenTicker() {
  const [tokens, setTokens] = useState<any[]>([]);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        // Fetch recent transactions from Supabase with token details
        const { data: recentTxs, error } = await supabase
          .from("transactions")
          .select(
            `
            token_address,
            timestamp,
            type,
            token_details:drawcoins!transactions_token_address_fkey(
              contract_address,
              name,
              symbol,
              image_url,
              category,
              current_price,
              volume_24h,
              holders
            )
          `
          )
          .order("timestamp", { ascending: false })
          .limit(100); // Fetch more to ensure we get unique tokens

        if (error) {
          console.error("Supabase error:", error);
          return;
        }

        if (!recentTxs || recentTxs.length === 0) {
          console.log("No recent transactions found");
          return;
        }

        // Get unique tokens (most recent transaction first)
        const uniqueTokensMap = new Map();

        for (const tx of recentTxs) {
          if (
            tx.token_details &&
            tx.token_address &&
            !uniqueTokensMap.has(tx.token_address)
          ) {
            uniqueTokensMap.set(tx.token_address, {
              ...tx.token_details,
              last_transaction: tx.timestamp,
              last_tx_type: tx.type,
            });
          }
        }

        const uniqueTokens = Array.from(uniqueTokensMap.values()).slice(0, 25);

        // Fetch market data from Zora for these tokens
        try {
          const response = await fetch("/api/market?limit=100");
          if (response.ok) {
            const marketData = await response.json();
            const marketMap = new Map(
              marketData.data?.map((token: any) => [
                token.contract_address?.toLowerCase(),
                token,
              ])
            );

            // Enrich with market data
            const enrichedTokens = uniqueTokens.map((token) => {
              const marketInfo: any = marketMap.get(
                token.contract_address?.toLowerCase()
              );
              return {
                ...token,
                marketCap: marketInfo?.marketCap || "0",
                volume24h:
                  marketInfo?.volume24h ||
                  marketInfo?.totalVolume ||
                  token.volume_24h ||
                  "0",
                marketCapDelta24h:
                  marketInfo?.marketCapDelta24h ||
                  marketInfo?.change24hPct ||
                  "0",
                address: token.contract_address,
              };
            });

            setTokens(enrichedTokens);
          } else {
            setTokens(uniqueTokens);
          }
        } catch (marketError) {
          console.error("Error fetching market data:", marketError);
          setTokens(uniqueTokens);
        }
      } catch (error) {
        console.error("Error fetching ticker tokens:", error);
      }
    };

    fetchTokens();
  }, []);

  // Duplicate tokens for seamless loop
  const duplicatedTokens = [...tokens, ...tokens];

  const handleTokenClick = (contractAddress: string) => {
    window.location.href = `/coin/${contractAddress}`;
  };

  const formatNumber = (num: string | number) => {
    const value = typeof num === "string" ? parseFloat(num) : num;
    if (isNaN(value)) return "0";
    if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
    if (value >= 1000) return (value / 1000).toFixed(1) + "K";
    return value.toFixed(0);
  };

  if (tokens.length === 0) {
    return null; // Don't show ticker if no tokens
  }

  return (
    <div className="bg-[#fcfcfc] border-b border-art-gray-200 py-1.5 overflow-hidden relative z-50">
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#fcfcfc] to-transparent z-10"></div>
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#fcfcfc] to-transparent z-10"></div>

      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        @media (max-width: 768px) {
          .animate-marquee {
            animation: marquee 25s linear infinite;
          }
        }
      `}</style>
      <div className="animate-marquee whitespace-nowrap flex items-center">
        {duplicatedTokens.map((token, index) => {
          const mc = token.marketCap || "0";
          const vol =
            token.volume24h || token.volume_24h || token.totalVolume || "0";
          const change = parseFloat(
            token.marketCapDelta24h || token.change24hPct || "0"
          );

          return (
            <div
              key={`${token.address || token.contract_address}-${index}`}
              className="inline-flex items-center mx-6 cursor-pointer hover:opacity-70 transition-opacity"
              onClick={() =>
                handleTokenClick(token.address || token.contract_address)
              }
            >
              <SafeImage
                src={token.image_url}
                alt={token.name}
                width={20}
                height={20}
                className="rounded-full mr-2 overflow-hidden border border-art-gray-200"
              />
              <span className="font-bold text-art-gray-800 text-xs mr-2">
                {token.symbol}
              </span>
              <div className="flex items-center space-x-3 text-[10px] text-art-gray-500">
                <span>MC: ${formatNumber(mc)}</span>
                <span>VOL: ${formatNumber(vol)}</span>
                <span
                  className={`font-medium ${
                    change >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {change >= 0 ? "↑" : "↓"} {Math.abs(change).toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
