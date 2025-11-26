import React from "react";
import { Coin } from "../../../lib/supabase";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../ui/Tabs";
import { SafeImage } from "../../ui/SafeImage";
import { PriceChart } from "../../charts/PriceChart";
import { RecentTrades } from "../../trades/RecentTrades";

interface CoinVisualsProps {
  token: Coin;
  poolAddress: string | null;
  totalSupply?: string;
}

export const CoinVisuals: React.FC<CoinVisualsProps> = ({
  token,
  poolAddress,
  totalSupply,
}) => {
  return (
    <Tabs defaultValue="image" className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="image">Image</TabsTrigger>
        <TabsTrigger value="chart">Chart</TabsTrigger>
        <TabsTrigger value="trades">Trades</TabsTrigger>
      </TabsList>
      <TabsContent value="image">
        <div
          className="relative overflow-hidden bg-gradient-to-br from-white to-art-gray-50 w-full min-h-[350px] lg:min-h-[600px]"
          style={{
            border: "3px solid #2d3748",
            borderRadius: "25px 15px 30px 20px",
            transform: "rotate(-0.3deg)",
            boxShadow: "6px 6px 0 #2d3748",
            height: "auto",
          }}
        >
          {token.image_url ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <div
                className="relative w-full"
                style={{
                  aspectRatio: "1 / 1", // Square container
                  maxWidth: "600px",
                  maxHeight: "600px",
                }}
              >
                <SafeImage
                  src={token.image_url}
                  alt={token.name}
                  width={600}
                  height={600}
                  className="w-full h-full object-contain rounded-lg shadow-sm"
                  lazy={false}
                  fluid={true}
                />
              </div>
            </div>
          ) : (
            <div className="w-full h-96 flex flex-col items-center justify-center text-art-gray-400">
              <div
                className="w-32 h-32 flex items-center justify-center bg-art-gray-100 rounded-full mb-4"
                style={{
                  border: "2px solid #2d3748",
                  borderRadius: "50% 40% 50% 40%",
                }}
              >
                <svg
                  className="w-16 h-16"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="text-lg font-medium">No Image Available</p>
              <p className="text-sm text-art-gray-500 mt-1">
                This token doesn't have an image
              </p>
            </div>
          )}

          {/* Decorative corner elements */}
          <div
            className="absolute top-2 right-2 w-4 h-4 bg-art-gray-900 rounded-full opacity-20"
            style={{ transform: "rotate(45deg)" }}
          />
          <div
            className="absolute bottom-2 left-2 w-3 h-3 bg-art-gray-900 rounded-full opacity-20"
            style={{ transform: "rotate(-45deg)" }}
          />
        </div>
      </TabsContent>

      <TabsContent value="chart">
        <PriceChart
          poolAddress={poolAddress || undefined}
          height={500}
          totalSupply={totalSupply || token.totalSupply}
        />
      </TabsContent>

      <TabsContent value="trades">
        <RecentTrades
          tokenAddress={token.contract_address}
          decimals={(token as any).decimals || 18}
        />
      </TabsContent>
    </Tabs>
  );
};
