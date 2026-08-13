import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { z } from "zod";

import {
  requireWalletSession,
  SessionError,
} from "@/lib/auth/session";
import {
  COIN_SNAPSHOT_COLUMNS,
  toSupabaseCoinSnapshot,
} from "@/lib/market/coinSnapshot";
import { evaluateMissions } from "@/lib/missions/service";
import type { Coin } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const priceSchema = z.number().finite().nonnegative().max(1e30).nullable().optional();
const watchlistMutationSchema = z.object({
  tokenAddress: z.string(),
  priceEth: priceSchema,
  priceUsd: priceSchema,
  priceTimestamp: z.string().datetime().optional(),
});

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function sessionError(error: unknown) {
  if (error instanceof SessionError) {
    return response({ error: error.code }, error.status);
  }
  return null;
}

async function findVerifiedCoin(tokenAddress: string) {
  if (!isAddress(tokenAddress)) return null;

  const result = await supabaseAdmin
    .from("drawcoins")
    .select("contract_address")
    .ilike("contract_address", getAddress(tokenAddress))
    .not("verified_at", "is", null)
    .maybeSingle();

  if (result.error) throw result.error;
  return result.data;
}

export async function GET() {
  try {
    const session = await requireWalletSession();
    const { data, error } = await supabaseAdmin
      .from("watchlists")
      .select(
        `token_address, added_at, added_price_eth, added_price_usd, added_price_timestamp, verified_at, coin:drawcoins!watchlists_token_address_fkey(${COIN_SNAPSHOT_COLUMNS})`
      )
      .ilike("user_address", session.address)
      .order("added_at", { ascending: false });

    if (error) throw error;
    const rows = (data ?? []) as unknown as Array<{
      token_address: string;
      added_at: string;
      added_price_eth: number | string | null;
      added_price_usd: number | string | null;
      added_price_timestamp: string | null;
      verified_at: string | null;
      coin: Coin | null;
    }>;
    const items = rows.map(({ coin, ...item }) => ({
      ...item,
      coin: coin ? toSupabaseCoinSnapshot(coin) : null,
    }));

    return response({ items, source: "supabase" });
  } catch (error) {
    const authResponse = sessionError(error);
    if (authResponse) return authResponse;
    console.error("Failed to load watchlist", error);
    return response({ error: "WATCHLIST_UNAVAILABLE" }, 503);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireWalletSession();
    const input = watchlistMutationSchema.parse(await request.json());
    const coin = await findVerifiedCoin(input.tokenAddress);

    if (!coin) return response({ error: "DRAWCOIN_NOT_FOUND" }, 404);

    const userAddress = session.address.toLowerCase();
    const verifiedAt = new Date().toISOString();
    const { error: userError } = await supabaseAdmin.from("users").upsert(
      { address: userAddress, last_active: verifiedAt },
      { onConflict: "address" }
    );
    if (userError) throw userError;

    const { data, error } = await supabaseAdmin
      .from("watchlists")
      .upsert(
        {
          user_address: userAddress,
          token_address: coin.contract_address,
          added_price_eth: input.priceEth ?? null,
          added_price_usd: input.priceUsd ?? null,
          added_price_timestamp: input.priceTimestamp ?? verifiedAt,
          verified_at: verifiedAt,
        },
        { onConflict: "user_address,token_address" }
      )
      .select(
        "token_address, added_at, added_price_eth, added_price_usd, added_price_timestamp"
      )
      .single();

    if (error) throw error;
    return response({ item: data, verified: true });
  } catch (error) {
    const authResponse = sessionError(error);
    if (authResponse) return authResponse;
    if (error instanceof z.ZodError) {
      return response({ error: "INVALID_WATCHLIST_PAYLOAD" }, 400);
    }
    console.error("Failed to add watchlist item", error);
    return response({ error: "WATCHLIST_UNAVAILABLE" }, 503);
  }
}

/**
 * Legacy watchlists have no onchain receipt. A current SIWE session plus an
 * explicit user action is therefore required before those rows may contribute
 * to mission progress. Only rows whose DrawCoin is already verified qualify.
 */
export async function PATCH() {
  try {
    const session = await requireWalletSession();
    const normalizedAddress = session.address.toLowerCase();
    const { data, error } = await supabaseAdmin.rpc(
      "reconfirm_legacy_watchlists",
      { p_address: normalizedAddress }
    );
    if (error) throw error;

    const counts = data?.[0] ?? {
      confirmed_count: 0,
      remaining_count: 0,
    };
    const missions = await evaluateMissions(normalizedAddress);

    return response({
      success: true,
      confirmed: counts.confirmed_count,
      remaining: counts.remaining_count,
      missions,
    });
  } catch (error) {
    const authResponse = sessionError(error);
    if (authResponse) return authResponse;
    console.error("Failed to reconfirm legacy watchlist items", error);
    return response({ error: "WATCHLIST_RECONFIRMATION_UNAVAILABLE" }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireWalletSession();
    const input = watchlistMutationSchema.pick({ tokenAddress: true }).parse(
      await request.json()
    );
    if (!isAddress(input.tokenAddress)) {
      return response({ error: "INVALID_WATCHLIST_PAYLOAD" }, 400);
    }

    const { error } = await supabaseAdmin
      .from("watchlists")
      .delete()
      .eq("user_address", session.address.toLowerCase())
      // Removing a private row must remain possible even when the referenced
      // legacy coin has not yet completed provenance reconciliation.
      .ilike("token_address", getAddress(input.tokenAddress));

    if (error) throw error;
    return response({ success: true });
  } catch (error) {
    const authResponse = sessionError(error);
    if (authResponse) return authResponse;
    if (error instanceof z.ZodError) {
      return response({ error: "INVALID_WATCHLIST_PAYLOAD" }, 400);
    }
    console.error("Failed to remove watchlist item", error);
    return response({ error: "WATCHLIST_UNAVAILABLE" }, 503);
  }
}
