import { NextRequest, NextResponse } from "next/server";

import {
  ApiInputError,
  parseAddressList,
} from "@/lib/api/requestValidation";
import {
  COIN_SNAPSHOT_COLUMNS,
  toSupabaseCoinSnapshot,
} from "@/lib/market/coinSnapshot";
import type { Coin } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const addresses = parseAddressList(
      request.nextUrl.searchParams.get("addresses"),
      100
    );
    // Address input is already restricted to hexadecimal EVM addresses, so
    // this case-insensitive PostgREST OR cannot introduce filter syntax.
    const addressFilter = addresses
      .map((address) => `contract_address.ilike.${address}`)
      .join(",");
    const { data, error } = await supabaseAdmin
      .from("drawcoins")
      .select(COIN_SNAPSHOT_COLUMNS)
      .or(addressFilter);

    if (error) throw error;
    const byAddress = new Map(
      ((data ?? []) as unknown as Coin[]).map((coin) => [
        coin.contract_address.toLowerCase(),
        coin,
      ])
    );
    const items = addresses.flatMap((address) => {
      const coin = byAddress.get(address);
      return coin
        ? [
            {
              token_address: coin.contract_address,
              added_at: coin.created_at,
              verified_at: null,
              coin: toSupabaseCoinSnapshot(coin),
            },
          ]
        : [];
    });

    return NextResponse.json(
      { items, source: "supabase" },
      {
        headers: {
          "Cache-Control":
            "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
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
    console.error("Failed to load device watchlist coins", error);
    return NextResponse.json(
      { error: "WATCHLIST_UNAVAILABLE" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "5" },
      }
    );
  }
}
