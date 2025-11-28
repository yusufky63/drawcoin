import { NextResponse } from "next/server";
import { AnalyticsService } from "@/services/analyticsService";
import { getCoinsBatchWithRetry } from "@/services/zoraService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    // 1. Fetch from DB
    const tokens = await AnalyticsService.getMostWatchlisted(limit, offset);

    // 2. Fetch live Zora data
    const uniqueAddresses = Array.from(
      new Set(tokens.map((t) => t.contract_address))
    ).filter(Boolean);

    let zoraDataMap: Record<string, any> = {};
    if (uniqueAddresses.length > 0) {
      try {
        zoraDataMap = await getCoinsBatchWithRetry(uniqueAddresses);
      } catch (error) {
        console.warn(
          "Failed to fetch live Zora data for watchlist page:",
          error
        );
      }
    }

    // 3. Merge data
    const enrichedTokens = tokens.map((token) => {
      const zoraData = zoraDataMap[token.contract_address.toLowerCase()];
      if (!zoraData) return token;

      return {
        ...token,
        current_price:
          zoraData.tokenPrice?.priceInUsd || zoraData.tokenPrice?.priceInUsdc,
        market_cap: zoraData.marketCap,
        price_change_24h: zoraData.marketCapDelta24h,
        image_url:
          zoraData.mediaContent?.previewImage?.small || token.image_url,
      };
    });

    return NextResponse.json({
      tokens: enrichedTokens,
      hasMore: tokens.length === limit,
    });
  } catch (error) {
    console.error("Error fetching most watchlisted:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
