import { NextResponse } from "next/server";
import { AnalyticsService } from "@/services/analyticsService";
import { ApiInputError, parseBoundedInteger } from "@/lib/api/requestValidation";
import { toSupabaseCoinSnapshot } from "@/lib/market/coinSnapshot";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseBoundedInteger(searchParams.get("limit"), {
      fallback: 20,
      minimum: 1,
      maximum: 50,
    });
    const offset = parseBoundedInteger(searchParams.get("offset"), {
      fallback: 0,
      minimum: 0,
      maximum: 10_000,
    });

    // Request one extra row so `hasMore` is exact without a count query.
    const rows = await AnalyticsService.getMostWatchlisted(limit + 1, offset, {
      throwOnError: true,
    });
    const hasMore = rows.length > limit;
    const tokens = rows.slice(0, limit).map(toSupabaseCoinSnapshot);

    return NextResponse.json(
      {
        tokens,
        hasMore,
        liveDataStale: false,
        source: "supabase",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    if (error instanceof ApiInputError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } }
      );
    }
    console.error("Error fetching most watchlisted:", error);
    return NextResponse.json(
      { error: "Watchlist data is temporarily unavailable.", retryable: true },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "5" },
      }
    );
  }
}
