import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/services/analyticsService";

// Simple in-memory cache for leaderboard
// Key: type_limit, Value: { data, timestamp }
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour for leaderboard

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") as "creators" | "buyers" | "tokens";
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  if (
    !type ||
    (type !== "creators" && type !== "buyers" && type !== "tokens")
  ) {
    return NextResponse.json(
      { error: "Invalid type. Must be 'creators' or 'buyers'" },
      { status: 400 }
    );
  }

  const refresh = searchParams.get("refresh") === "true";

  const cacheKey = `${type}_${limit}`;
  const now = Date.now();

  // Check cache (only if not refreshing)
  if (!refresh && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_TTL) {
      console.log(`[Leaderboard API] Serving ${cacheKey} from CACHE ⚡`);
      return NextResponse.json({
        data: cached.data,
        lastUpdated: cached.timestamp,
        cached: true,
      });
    }
  }

  console.log(
    `[Leaderboard API] Cache miss for ${cacheKey}. Fetching from DB... 🐢`
  );

  try {
    let data = [];
    if (type === "creators") {
      data = await AnalyticsService.getLeaderboard("created", limit);
    } else if (type === "tokens") {
      data = await AnalyticsService.getTopTokens(limit);
    } else {
      data = await AnalyticsService.getTopBuyers(limit);
    }

    // Update cache
    cache.set(cacheKey, { data, timestamp: now });

    return NextResponse.json({
      data,
      lastUpdated: now,
      cached: false,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard data" },
      { status: 500 }
    );
  }
}
