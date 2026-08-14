import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress, type Address } from "viem";

import { ApiInputError, parseAddressList } from "@/lib/api/requestValidation";
import { resolveBasenamesOnBase } from "@/lib/baseBasename";
import {
  MAX_CREATOR_BASENAME_RPC_BATCH,
  MAX_CREATOR_IDENTITY_BATCH,
  normalizeBasename,
} from "@/lib/creatorIdentity";
import { BoundedTtlCache } from "@/lib/server/boundedTtlCache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const basenameCache = new BoundedTtlCache<string | null>(1_000, 30 * 60 * 1000);

type PublicUser = {
  address: string;
  username: string | null;
};

type CachedIdentity = {
  address: string;
  basename: string | null;
  expires_at: string;
};

const RESOLVED_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMPTY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        status === 200
          ? "public, max-age=60, s-maxage=900, stale-while-revalidate=86400"
          : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function readPersistedBasenames(addresses: string[]) {
  const result = new Map<string, string>();
  if (addresses.length === 0) return result;

  const candidates = addresses.flatMap((address) => [
    address,
    getAddress(address),
  ]);
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("address, username")
    .in("address", candidates);

  if (error) {
    // User profiles are public read-model data. A failure should only remove
    // optional enrichment, never fail the market page or expose provider URLs.
    console.warn("Persisted creator identities are temporarily unavailable");
    return result;
  }

  for (const user of (data ?? []) as PublicUser[]) {
    const address = user.address?.toLowerCase();
    const basename = normalizeBasename(user.username);
    if (address && basename) result.set(address, basename);
  }
  return result;
}

async function readIdentityCache(addresses: string[]) {
  const result = new Map<string, string | null>();
  if (addresses.length === 0) return result;

  const { data, error } = await supabaseAdmin
    .from("creator_identity_cache")
    .select("address, basename, expires_at")
    .in("address", addresses)
    .gt("expires_at", new Date().toISOString());

  if (error) {
    console.warn("Persisted Base Name cache is temporarily unavailable");
    return result;
  }

  for (const row of (data ?? []) as CachedIdentity[]) {
    const address = row.address?.toLowerCase();
    if (!address) continue;
    result.set(address, normalizeBasename(row.basename));
  }
  return result;
}

async function persistIdentities(
  values: ReadonlyArray<{
    address: string;
    basename: string | null;
    source: "profile" | "base-l2" | "none";
  }>
) {
  if (values.length === 0) return;
  const now = Date.now();
  const rows = values.map((value) => ({
    ...value,
    checked_at: new Date(now).toISOString(),
    expires_at: new Date(
      now + (value.basename ? RESOLVED_CACHE_TTL_MS : EMPTY_CACHE_TTL_MS)
    ).toISOString(),
    updated_at: new Date(now).toISOString(),
  }));
  const { error } = await supabaseAdmin
    .from("creator_identity_cache")
    .upsert(rows, { onConflict: "address" });
  if (error) console.warn("Base Name cache update was skipped");
}

async function resolveBasenames(addresses: string[]) {
  const result: Record<string, string | null> = {};
  const uncached: string[] = [];

  for (const address of addresses) {
    const cached = basenameCache.get(address);
    if (cached !== undefined) result[address] = cached;
    else uncached.push(address);
  }

  if (uncached.length === 0) return result;

  const [persisted, databaseCache] = await Promise.all([
    readPersistedBasenames(uncached),
    readIdentityCache(uncached),
  ]);
  const rpcCandidates: string[] = [];
  const cacheWrites: Array<{
    address: string;
    basename: string | null;
    source: "profile" | "base-l2" | "none";
  }> = [];
  for (const address of uncached) {
    const basename = persisted.get(address);
    if (basename) {
      basenameCache.set(address, basename);
      result[address] = basename;
      cacheWrites.push({ address, basename, source: "profile" });
    } else if (databaseCache.has(address)) {
      const cached = databaseCache.get(address) ?? null;
      basenameCache.set(address, cached);
      result[address] = cached;
    } else {
      rpcCandidates.push(address);
    }
  }

  const rpcBatch = rpcCandidates.slice(0, MAX_CREATOR_BASENAME_RPC_BATCH);
  const deferredFallback = rpcCandidates.slice(MAX_CREATOR_BASENAME_RPC_BATCH);
  for (const address of deferredFallback) result[address] = null;

  // The official Base L2 resolver is read with one multicall for the whole
  // visible page. This replaces up to 50 independent ENSIP-19 RPC requests.
  const resolutions = await resolveBasenamesOnBase(
    rpcBatch.map((address) => getAddress(address) as Address)
  );
  for (const address of rpcBatch) {
    const basename = resolutions.get(address) ?? null;
    basenameCache.set(address, basename);
    result[address] = basename;
    cacheWrites.push({
      address,
      basename,
      source: basename ? "base-l2" : "none",
    });
  }

  await persistIdentities(cacheWrites);

  return result;
}

export async function GET(request: NextRequest) {
  try {
    const singleAddress = request.nextUrl.searchParams.get("address");
    const addressList = request.nextUrl.searchParams.get("addresses");
    if (singleAddress && addressList) {
      return json({ error: "Provide address or addresses, not both." }, 400);
    }

    if (singleAddress && !isAddress(singleAddress)) {
      return json({ error: "INVALID_ADDRESS" }, 400);
    }

    const addresses = parseAddressList(
      addressList ?? singleAddress,
      MAX_CREATOR_IDENTITY_BATCH
    );
    const basenames = await resolveBasenames(addresses);

    return singleAddress
      ? json({ basename: basenames[addresses[0]] ?? null })
      : json({ basenames });
  } catch (error) {
    if (error instanceof ApiInputError) {
      return json({ error: error.message }, error.status);
    }
    // Private RPC URLs commonly contain credentials. Never log the raw viem
    // error because it can include the request URL.
    console.warn("Basename resolution is temporarily unavailable");
    return json({ error: "Basenames are temporarily unavailable." }, 503);
  }
}
