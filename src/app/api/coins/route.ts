import { NextRequest, NextResponse } from "next/server";

import {
  ApiInputError,
  normalizeEvmAddress,
  parseBoundedInteger,
} from "@/lib/api/requestValidation";
import { CoinService } from "@/services/coinService";

const ALLOWED_QUERY_PARAMETERS = new Set([
  "category",
  "creator",
  "limit",
  "offset",
  "search",
]);

function readSingle(searchParams: URLSearchParams, key: string) {
  const values = searchParams.getAll(key);
  if (values.length > 1) {
    throw new ApiInputError(`The ${key} parameter must be provided once.`);
  }
  return values[0] ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    for (const key of searchParams.keys()) {
      if (!ALLOWED_QUERY_PARAMETERS.has(key)) {
        throw new ApiInputError("The coin query contains an unknown parameter.");
      }
    }

    const category = (readSingle(searchParams, "category") ?? "").trim();
    const creatorInput = (readSingle(searchParams, "creator") ?? "").trim();
    const search = (readSingle(searchParams, "search") ?? "").trim();
    const limit = parseBoundedInteger(readSingle(searchParams, "limit"), {
      fallback: 20,
      minimum: 1,
      maximum: 100,
    });
    const offset = parseBoundedInteger(readSingle(searchParams, "offset"), {
      fallback: 0,
      minimum: 0,
      maximum: 10_000,
    });

    if (category.length > 80) {
      throw new ApiInputError("The category parameter is too long.");
    }
    if (search.length > 100) {
      throw new ApiInputError("The search parameter is too long.");
    }

    const creator = creatorInput ? normalizeEvmAddress(creatorInput) : null;
    if (creatorInput && !creator) {
      throw new ApiInputError("The creator address is invalid.", 422);
    }

    const params = {
      ...(category && { category }),
      ...(creator && { creator_address: creator }),
      ...(search && { search }),
      limit,
      offset,
    };

    const coins = await CoinService.getCoins(params, { throwOnError: true });

    return NextResponse.json(
      { success: true, data: coins, total: coins.length },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    if (error instanceof ApiInputError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } }
      );
    }
    console.error("Error fetching coins:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Coin data is temporarily unavailable.",
        retryable: true,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "5" },
      }
    );
  }
}

export async function POST(request: NextRequest) {
  void request;
  return NextResponse.json(
    {
      success: false,
      error:
        "Direct coin writes are disabled. Use the verified Base creation endpoint.",
    },
    { status: 405, headers: { Allow: "GET", "Cache-Control": "no-store" } }
  );
}
