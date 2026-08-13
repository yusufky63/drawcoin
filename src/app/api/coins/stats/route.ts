import { NextResponse } from "next/server";
import { CoinService } from "@/services/coinService";

export async function GET() {
  try {
    const stats = await CoinService.getCoinStats();

    return NextResponse.json(
      { success: true, data: stats },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error('Error fetching coin stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Coin statistics are temporarily unavailable.",
        retryable: true,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "5" },
      }
    );
  }
}
