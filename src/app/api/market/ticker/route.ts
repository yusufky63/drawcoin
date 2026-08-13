import { NextResponse } from "next/server";

import {
  buildTickerTokens,
  type TickerCoinSnapshotRow,
  type TickerResponseDto,
  type TickerTransactionRow,
} from "@/lib/market/tickerDto";
import { BoundedTtlCache } from "@/lib/server/boundedTtlCache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SOURCE_ROW_LIMIT = 72;
const TOKEN_LIMIT = 12;
const QUERY_DEADLINE_MS = 4_000;
const MEMORY_CACHE_TTL_MS = 30_000;

const responseCache = new BoundedTtlCache<TickerResponseDto>(
  1,
  MEMORY_CACHE_TTL_MS
);
let inFlightRequest: Promise<TickerResponseDto> | null = null;

async function loadTickerResponse() {
  const cacheKey = "supabase-ticker-v1";
  const cached = responseCache.get(cacheKey);
  if (cached) return cached;
  if (inFlightRequest) return inFlightRequest;

  inFlightRequest = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), QUERY_DEADLINE_MS);

    try {
      // Fetch activity and fallback rows together. Both queries select only the
      // fields used by the public DTO and have deterministic ordering.
      const [transactionsResult, catalogResult] = await Promise.all([
        supabaseAdmin
          .from("transactions")
          .select(
            `
            id,
            token_address,
            timestamp,
            type,
            verified_at,
            token_details:drawcoins!transactions_token_address_fkey(
              contract_address,
              name,
              symbol,
              image_url,
              current_price,
              total_supply,
              holders,
              last_synced_at
            )
          `
          )
          .order("timestamp", { ascending: false, nullsFirst: false })
          .order("id", { ascending: false })
          .limit(SOURCE_ROW_LIMIT)
          .abortSignal(controller.signal),
        supabaseAdmin
          .from("drawcoins")
          .select(
            "id,contract_address,name,symbol,image_url,current_price,total_supply,holders,last_synced_at,created_at"
          )
          .order("created_at", { ascending: false, nullsFirst: false })
          .order("id", { ascending: false })
          .limit(TOKEN_LIMIT * 2)
          .abortSignal(controller.signal),
      ]);

      if (transactionsResult.error) throw transactionsResult.error;
      if (catalogResult.error) throw catalogResult.error;

      const response: TickerResponseDto = {
        data: buildTickerTokens(
          (transactionsResult.data ?? []) as unknown as TickerTransactionRow[],
          (catalogResult.data ?? []) as unknown as TickerCoinSnapshotRow[],
          TOKEN_LIMIT
        ),
        source: "supabase",
        generatedAt: new Date().toISOString(),
      };
      responseCache.set(cacheKey, response);
      return response;
    } finally {
      clearTimeout(timeout);
    }
  })();

  try {
    return await inFlightRequest;
  } finally {
    inFlightRequest = null;
  }
}

export async function GET() {
  try {
    return NextResponse.json(await loadTickerResponse(), {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=30, stale-while-revalidate=300",
        "X-Content-Type-Options": "nosniff",
        "X-Ticker-Source": "supabase",
      },
    });
  } catch (error) {
    console.error(
      "Market ticker Supabase query failed",
      error instanceof Error ? error.message : "Unknown database error"
    );
    return NextResponse.json(
      { error: "Ticker data is temporarily unavailable." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "10" },
      }
    );
  }
}
