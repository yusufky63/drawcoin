import { NextResponse } from "next/server";

import {
  buildMarketMeta,
  MarketQueryError,
  parseMarketQuery,
} from "@/lib/market/requestPolicy";
import { toSupabaseCoinSnapshot } from "@/lib/market/coinSnapshot";
import { CoinService } from "@/services/coinService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(status === 503 ? { "Retry-After": "5" } : {}),
      },
    }
  );
}

export async function GET(request: Request) {
  let query;
  try {
    query = parseMarketQuery(new URL(request.url).searchParams);
  } catch (error) {
    if (error instanceof MarketQueryError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("The market query is invalid.", 400);
  }

  const { creationType, limit, page, search, sort } = query;
  const offset = (page - 1) * limit;

  try {
    const filters = { search, creation_type: creationType };
    const { coins: dbCoins, total } = await CoinService.getCoinsPage(
      { ...filters, limit, offset, sort },
      { throwOnError: true }
    );
    const meta = buildMarketMeta(total, limit, page);

    if (total === 0 || offset >= total) {
      return NextResponse.json(
        {
          data: [],
          meta,
          source: "supabase",
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
          },
        }
      );
    }

    return NextResponse.json(
      {
        data: dbCoins.map(toSupabaseCoinSnapshot),
        meta,
        source: "supabase",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Market API failed", error);
    return jsonError("Market data is temporarily unavailable.", 503);
  }
}
