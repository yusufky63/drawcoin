import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Force dynamic to prevent caching
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      symbol,
      description,
      contract_address,
      image_url,
      category,
      creator_address,
      creator_name,
      tx_hash,
      chain_id,
      currency,
      platform_referrer,
      creation_type,
    } = body;

    // Basic validation
    if (!name || !symbol || !contract_address || !creator_address) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS for server-side operations
    const { data, error } = await supabaseAdmin
      .from("drawcoins")
      .insert({
        name,
        symbol,
        description,
        contract_address,
        image_url,
        category,
        creator_address,
        creator_name,
        tx_hash,
        chain_id: chain_id || 8453,
        currency: currency || "ETH",
        platform_referrer,
        creation_type: creation_type || "hand-drawn",
        holders: 1, // Creator is the first holder
        current_price: 0,
        volume_24h: 0,
        total_supply: 0,
        last_synced_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving coin to DB:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error in create coin API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
