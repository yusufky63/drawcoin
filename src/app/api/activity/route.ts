import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/services/analyticsService";
import { ApiInputError, parseBoundedInteger } from "@/lib/api/requestValidation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
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
    const requestedType = searchParams.get("type");
    if (
      requestedType !== null &&
      requestedType !== "buy" &&
      requestedType !== "sell" &&
      requestedType !== "create"
    ) {
      throw new ApiInputError("Invalid activity type.");
    }
    const type = requestedType ?? undefined;

    const transactions = await AnalyticsService.getRecentTransactions(
      limit,
      offset,
      type,
      { throwOnError: true }
    );

    return NextResponse.json({
      data: transactions,
      timestamp: Date.now(),
    });
  } catch (error) {
    if (error instanceof ApiInputError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } }
      );
    }
    console.error("Error fetching activity:", error);
    return NextResponse.json(
      { error: "Activity is temporarily unavailable.", retryable: true },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "5" },
      }
    );
  }
}
