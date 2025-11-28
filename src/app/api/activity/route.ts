import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/services/analyticsService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const type = searchParams.get("type") as
      | "buy"
      | "sell"
      | "create"
      | undefined;

    const transactions = await AnalyticsService.getRecentTransactions(
      limit,
      offset,
      type
    );

    return NextResponse.json({
      data: transactions,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Error fetching activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity data" },
      { status: 500 }
    );
  }
}
