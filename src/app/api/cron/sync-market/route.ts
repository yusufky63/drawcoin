import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapWithConcurrency } from "@/lib/market/requestPolicy";
import { getCoinsBatchWithRetry } from "@/services/zoraService";

// Force dynamic to prevent caching
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function secretsMatch(candidate: string, expected: string) {
  const candidateDigest = createHash("sha256").update(candidate).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateDigest, expectedDigest);
}

export async function GET(req: NextRequest) {
  try {
    // 1. Security Check
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (!cronSecret) {
      console.error("[SyncMarket] CRON_SECRET is not configured.");
      return NextResponse.json(
        { error: "Cron is not configured." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const authHeader = req.headers.get("authorization");
    const { searchParams } = new URL(req.url);
    const candidate = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";

    if (!candidate || !secretsMatch(candidate, cronSecret)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 2. Determine Sync Strategy (Active vs Stale)
    // We can use a query param ?type=active or ?type=stale
    const type = searchParams.get("type") || "active";
    if (type !== "active" && type !== "stale") {
      return NextResponse.json(
        { error: "Invalid sync type." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    const limit = 50; // Zora API batch limit

    let coinsToSync: Array<{ contract_address: string }> = [];

    if (type === "active") {
      // Strategy: Fetch coins with > 0 watchlist count OR created recently
      // These are "High Priority"
      const { data, error } = await supabaseAdmin
        .from("drawcoins")
        .select("contract_address")
        .or(
          `watchlist_count.gt.0,created_at.gt.${new Date(
            Date.now() - 7 * 24 * 60 * 60 * 1000
          ).toISOString()}`
        )
        .order("last_synced_at", { ascending: true, nullsFirst: true }) // Sync oldest first
        .limit(limit);

      if (error) throw error;
      coinsToSync = data || [];
    } else {
      // Strategy: Fetch "Stale" coins (older than 6h sync)
      // These are "Low Priority"
      const { data, error } = await supabaseAdmin
        .from("drawcoins")
        .select("contract_address")
        .or(
          `last_synced_at.is.null,last_synced_at.lt.${new Date(
            Date.now() - 6 * 60 * 60 * 1000
          ).toISOString()}`
        )
        .limit(limit);

      if (error) throw error;
      coinsToSync = data || [];
    }

    const addresses = coinsToSync.map((c) => c.contract_address);
    console.log(`[SyncMarket] Syncing ${addresses.length} ${type} coins...`);

    if (addresses.length === 0) {
      return NextResponse.json(
        { success: true, synced: 0, type },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // 3. Fetch Live Data from Zora
    const zoraDataMap = await getCoinsBatchWithRetry(addresses, 8453, {
      maxRetries: 2,
      signal: AbortSignal.timeout(45_000),
    });

    // 4. Update Database (Using individual updates to avoid INSERT constraints)
    const results = await mapWithConcurrency(addresses, 8, async (address) => {
      const data = zoraDataMap[address.toLowerCase()];
      if (!data) return null;

      const priceUsd = parseFloat(
        data.tokenPrice?.priceInUsdc || data.tokenPrice?.priceInUsd || ""
      );
      const volume = Number(data.volume24h);
      const supply = Number(data.totalSupply);
      const holders = Number(data.uniqueHolders);

      // A successful refresh also clears unavailable numeric snapshots. This
      // prevents an old/lifetime metric from looking like fresh 24h data.
      const payload: Record<string, string | number | null> = {
        current_price:
          Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : null,
        volume_24h:
          Number.isFinite(volume) && volume >= 0 ? volume : null,
        total_supply:
          Number.isFinite(supply) && supply > 0 ? supply : null,
        last_synced_at: new Date().toISOString(),
      };
      if (
        Number.isFinite(holders) &&
        Number.isInteger(holders) &&
        holders >= 0
      ) {
        payload.holders = holders;
      }

      // Optionally update metadata if available and valid
      if (data.name) payload.name = data.name;
      if (data.symbol) payload.symbol = data.symbol;
      if (data.description) payload.description = data.description;
      if (data.mediaContent?.previewImage?.small || data.image) {
        payload.image_url =
          data.mediaContent?.previewImage?.small || data.image;
      }

      const { error } = await supabaseAdmin
        .from("drawcoins")
        .update(payload)
        .eq("contract_address", address);

      if (error) {
        console.error("[SyncMarket] Supabase update failed", {
          address,
          code: error.code,
        });
        return null;
      }
      return address;
    });
    const updatedCount = results.filter(Boolean).length;

    return NextResponse.json(
      { success: true, synced: updatedCount, type },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    const errorCode =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : undefined;
    console.error("[SyncMarket] Sync failed", { code: errorCode });
    return NextResponse.json(
      { error: "Market sync failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
