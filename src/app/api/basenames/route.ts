import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress, toCoinType } from "viem";
import { base } from "viem/chains";

import { ApiInputError, parseAddressList } from "@/lib/api/requestValidation";
import {
  MAX_CREATOR_BASENAME_RPC_FALLBACK,
  MAX_CREATOR_IDENTITY_BATCH,
  normalizeBasename,
} from "@/lib/creatorIdentity";
import {
  getEthereumPublicClient,
  isEthereumPublicClientConfigured,
} from "@/lib/ethereumPublicClient";
import { supabase } from "@/lib/supabase";
import { BoundedTtlCache } from "@/lib/server/boundedTtlCache";

export const dynamic = "force-dynamic";

const basenameCache = new BoundedTtlCache<string | null>(1_000, 30 * 60 * 1000);

type PublicUser = {
  address: string;
  username: string | null;
};

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
  const { data, error } = await supabase
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

async function resolveBasenames(addresses: string[]) {
  const result: Record<string, string | null> = {};
  const uncached: string[] = [];

  for (const address of addresses) {
    const cached = basenameCache.get(address);
    if (cached !== undefined) result[address] = cached;
    else uncached.push(address);
  }

  if (uncached.length === 0) return result;

  const persisted = await readPersistedBasenames(uncached);
  const rpcFallback: string[] = [];
  for (const address of uncached) {
    const basename = persisted.get(address);
    if (basename) {
      basenameCache.set(address, basename);
      result[address] = basename;
    } else {
      rpcFallback.push(address);
    }
  }

  if (!isEthereumPublicClientConfigured()) {
    for (const address of rpcFallback) {
      basenameCache.set(address, null);
      result[address] = null;
    }
    return result;
  }

  const rpcCandidates = rpcFallback.slice(
    0,
    MAX_CREATOR_BASENAME_RPC_FALLBACK
  );
  const deferredFallback = rpcFallback.slice(
    MAX_CREATOR_BASENAME_RPC_FALLBACK
  );
  for (const address of deferredFallback) result[address] = null;

  // The shared transport has a 2.5 second timeout with retries disabled. The
  // RPC subset is capped independently from the Supabase batch so arbitrary
  // public requests cannot fan out into an unbounded number of RPC calls.
  const publicClient = getEthereumPublicClient();
  const resolutions = await Promise.allSettled(
    rpcCandidates.map((address) =>
      publicClient.getEnsName({
        address: getAddress(address),
        coinType: toCoinType(base.id),
      })
    )
  );

  resolutions.forEach((resolution, index) => {
    const address = rpcCandidates[index];
    const basename =
      resolution.status === "fulfilled"
        ? normalizeBasename(resolution.value)
        : null;
    basenameCache.set(address, basename);
    result[address] = basename;
  });

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
