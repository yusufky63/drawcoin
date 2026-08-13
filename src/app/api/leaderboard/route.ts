import { NextRequest, NextResponse } from "next/server";
import { parseBoundedInteger, ApiInputError } from "@/lib/api/requestValidation";
import { AnalyticsService } from "@/services/analyticsService";

const LEADERBOARD_TYPES = new Set(["creators", "buyers", "tokens"]);

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  if (!type || !LEADERBOARD_TYPES.has(type)) {
    return NextResponse.json(
      { error: "Invalid leaderboard type." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  let limit: number;
  try {
    limit = parseBoundedInteger(request.nextUrl.searchParams.get("limit"), {
      fallback: 50,
      minimum: 1,
      maximum: 100,
    });
  } catch (error) {
    const status = error instanceof ApiInputError ? error.status : 400;
    return NextResponse.json(
      { error: "Invalid limit." },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const data =
      type === "creators"
        ? await AnalyticsService.getLeaderboard("created", limit, {
            throwOnError: true,
          })
        : type === "tokens"
          ? await AnalyticsService.getTopTokens(limit, { throwOnError: true })
          : await AnalyticsService.getTopBuyers(limit, { throwOnError: true });

    return NextResponse.json(
      { data, lastUpdated: Date.now() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Leaderboard data fetch failed", error);
    return NextResponse.json(
      { error: "Leaderboard data is temporarily unavailable.", retryable: true },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "5" },
      }
    );
  }
}
