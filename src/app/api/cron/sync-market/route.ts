import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCoinsBatchWithRetry } from "@/services/zoraService";

// Force dynamic to prevent caching
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // 1. Security Check
    const authHeader = req.headers.get("authorization");
    const { searchParams } = new URL(req.url);
    const queryKey = searchParams.get("key");

    if (
      authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
      queryKey !== process.env.CRON_SECRET
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Determine Sync Strategy (Active vs Stale)
    // We can use a query param ?type=active or ?type=stale
    const type = searchParams.get("type") || "active";
    const limit = 50; // Zora API batch limit

    let coinsToSync: any[] = [];

    if (type === "active") {
      // Strategy: Fetch coins with > 0 watchlist count OR created recently
      // These are "High Priority"
      const { data, error } = await supabaseAdmin
        .from("drawcoins")
        .select("contract_address")
        .or("watchlist_count.gt.0,created_at.gt.now()-7days")
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
        .lt(
          "last_synced_at",
          new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        )
        .limit(limit);

      if (error) throw error;
      coinsToSync = data || [];
    }

    const addresses = coinsToSync.map((c) => c.contract_address);
    console.log(`[SyncMarket] Syncing ${addresses.length} ${type} coins...`);

    // 3. Fetch Live Data from Zora
    const zoraDataMap = await getCoinsBatchWithRetry(addresses);

    // 4. Update Database (Using individual updates to avoid INSERT constraints)
    const updatePromises = addresses.map(async (address) => {
      const data = zoraDataMap[address.toLowerCase()];
      if (!data) return null;

      const price = parseFloat(data.tokenPrice?.priceInPoolToken || "0");
      const volume = parseFloat(data.volume24h || data.totalVolume || "0");
      const supply = parseFloat(data.totalSupply || "0");

      // Only update fields we have, don't touch others
      const payload: any = {
        current_price: isNaN(price) ? 0 : price,
        volume_24h: isNaN(volume) ? 0 : volume,
        total_supply: isNaN(supply) ? 0 : supply,
        holders: data.uniqueHolders || 0,
        last_synced_at: new Date().toISOString(),
      };

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
        console.error(`Failed to update ${address}:`, error);
        return null;
      }
      return address;
    });

    const results = await Promise.all(updatePromises);
    const updatedCount = results.filter(Boolean).length;

    return NextResponse.json({
      success: true,
      synced: updatedCount,
      type,
    });
  } catch (error: any) {
    console.error("[SyncMarket] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
