import { NextResponse } from "next/server";
import {
  ApiInputError,
  parseAddressList,
  readJsonBody,
} from "@/lib/api/requestValidation";
import {
  normalizeWatchlistCounts,
  type WatchlistCountRow,
} from "@/lib/market/requestPolicy";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type WatchlistCountsRpcClient = {
  rpc: (
    functionName: "get_watchlist_counts",
    args: { p_addresses: string[] }
  ) => Promise<{
    data: WatchlistCountRow[] | null;
    error: { message: string } | null;
  }>;
};

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{ tokens?: unknown }>(request, 16 * 1024);
    if (!Array.isArray(body.tokens) || body.tokens.length === 0) {
      return NextResponse.json(
        { data: {} },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    if (body.tokens.length > 100 || body.tokens.some((token) => typeof token !== "string")) {
      throw new ApiInputError("At most 100 valid token addresses are allowed.", 422);
    }

    const tokens = parseAddressList(body.tokens.join(","), 100);
    // This aggregate is deliberately available only through the server's
    // service-role client. If the RPC is missing or unavailable we fail closed
    // instead of downloading the watchlists table and counting in memory.
    const rpcClient = supabaseAdmin as unknown as WatchlistCountsRpcClient;
    const { data, error } = await rpcClient.rpc("get_watchlist_counts", {
      p_addresses: tokens,
    });
    if (error) throw error;

    const counts = normalizeWatchlistCounts(tokens, data);

    return NextResponse.json(
      { data: counts },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof ApiInputError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } }
      );
    }
    console.error("Market stats fetch failed", error);
    return NextResponse.json(
      { error: "Market statistics are temporarily unavailable." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "5" },
      }
    );
  }
}
