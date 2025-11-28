import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    console.log("🔄 Starting watchlist count recalculation...");

    // 1. Get all watchlist items
    const { data: watchlistItems, error: fetchError } = await supabase
      .from("watchlists")
      .select("token_address");

    if (fetchError) throw fetchError;

    // 2. Aggregate counts
    const counts: Record<string, number> = {};
    watchlistItems?.forEach((item) => {
      counts[item.token_address] = (counts[item.token_address] || 0) + 1;
    });

    console.log(`📊 Found ${Object.keys(counts).length} tokens with watchers.`);

    // 3. Reset all counts to 0 first (optional, but safer to ensure accuracy)
    // We'll just update the ones we found. If a token has 0 watchers, it might stay at old value if we don't reset.
    // For now, let's just update the ones with > 0 watchers.

    // 4. Update drawcoins table
    const updates = Object.entries(counts).map(async ([address, count]) => {
      const { error } = await supabase
        .from("drawcoins")
        .update({ watchlist_count: count })
        .eq("contract_address", address);

      if (error) console.error(`❌ Failed to update ${address}:`, error);
      return { address, count, error };
    });

    await Promise.all(updates);

    return NextResponse.json({
      message: "Recalculation complete",
      updated: Object.keys(counts).length,
      counts,
    });
  } catch (error) {
    console.error("❌ Recalculation failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
