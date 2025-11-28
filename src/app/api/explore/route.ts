import { NextResponse } from "next/server";
import { AnalyticsService } from "@/services/analyticsService";
import { getCoinsBatchWithRetry } from "@/services/zoraService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Fetch base lists from DB
    const [mostWatchlisted, topAI, topHandDrawn, recentActivity] =
      await Promise.all([
        AnalyticsService.getMostWatchlisted(10),
        AnalyticsService.getTopAI(10),
        AnalyticsService.getTopHandDrawn(10),
        AnalyticsService.getRecentTransactions(10), // For ticker
      ]);

    // 2. Collect all unique token addresses
    const allTokens = [...mostWatchlisted, ...topAI, ...topHandDrawn];

    const uniqueAddresses = Array.from(
      new Set(allTokens.map((t) => t.contract_address))
    ).filter(Boolean);

    // 3. Fetch live market data from Zora
    let zoraDataMap: Record<string, any> = {};
    if (uniqueAddresses.length > 0) {
      try {
        zoraDataMap = await getCoinsBatchWithRetry(uniqueAddresses);
      } catch (error) {
        console.warn("Failed to fetch live Zora data for explore:", error);
      }
    }

    const enrichTokens = (tokens: any[]) => {
      return tokens.map((token) => {
        const zoraData = zoraDataMap[token.contract_address.toLowerCase()];
        if (!zoraData) return token;

        const parseVal = (val: any) => {
          if (typeof val === "number") return val;
          if (typeof val === "string") return parseFloat(val);
          return 0;
        };

        return {
          ...token,
          current_price: parseVal(
            zoraData.tokenPrice?.priceInUsd || zoraData.tokenPrice?.priceInUsdc
          ),
          market_cap: parseVal(zoraData.marketCap),
          price_change_24h: parseVal(zoraData.marketCapDelta24h),
          volume_24h: parseVal(zoraData.volume24h),
          // Prefer Zora image if available (often better optimized)
          image_url:
            zoraData.mediaContent?.previewImage?.small || token.image_url,
        };
      });
    };

    return NextResponse.json({
      mostWatchlisted: enrichTokens(mostWatchlisted),
      topAI: enrichTokens(topAI),
      topHandDrawn: enrichTokens(topHandDrawn),
      recentActivity,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Error fetching explore data:", error);
    return NextResponse.json(
      { error: "Failed to fetch explore data" },
      { status: 500 }
    );
  }
}
