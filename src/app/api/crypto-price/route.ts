import { NextResponse } from "next/server";
import {
  getFreshCryptoPrice,
  type SupportedPriceSymbol,
} from "@/lib/server/cryptoPrice";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPPORTED_SYMBOLS = new Set<SupportedPriceSymbol>(["ETH", "ZORA"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedSymbol = (searchParams.get("symbol") || "ETH").toUpperCase();

  if (!SUPPORTED_SYMBOLS.has(requestedSymbol as SupportedPriceSymbol)) {
    return NextResponse.json(
      { error: `Symbol ${requestedSymbol} is not supported.` },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const symbol = requestedSymbol as SupportedPriceSymbol;

  try {
    const quote = await getFreshCryptoPrice(symbol);

    return NextResponse.json(
      {
        success: true,
        ...quote,
        // Kept for existing consumers; this is the time the upstream response
        // was actually observed, never the time a stale Next fetch was read.
        timestamp: quote.observedAt,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(`[CryptoPrice] All live sources failed for ${symbol}.`, error);

    return NextResponse.json(
      {
        success: false,
        error: `Live ${symbol} price is temporarily unavailable.`,
        retryable: true,
        symbol,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "Retry-After": "10",
        },
      }
    );
  }
}
