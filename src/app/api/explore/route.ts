import { NextResponse } from "next/server";
import { AnalyticsService } from "@/services/analyticsService";
import { toSupabaseCoinSnapshot } from "@/lib/market/coinSnapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // MarketPage only renders this list, so avoid three unused database reads.
    const mostWatchlisted = await AnalyticsService.getMostWatchlisted(10, 0, {
      throwOnError: true,
    });

    return NextResponse.json(
      {
        mostWatchlisted: mostWatchlisted.map(toSupabaseCoinSnapshot),
        source: "supabase",
        timestamp: Date.now(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching explore data:", error);
    return NextResponse.json(
      {
        error: "Explore data is temporarily unavailable.",
        retryable: true,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": "5",
        },
      }
    );
  }
}
