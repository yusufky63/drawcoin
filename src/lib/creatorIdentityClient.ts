"use client";

import { createCreatorAddressBatch } from "@/lib/creatorIdentity";
import { BoundedTtlCache } from "@/lib/server/boundedTtlCache";

export type BasenamesResponse = {
  basenames: Record<string, string | null>;
};

const CLIENT_IDENTITY_TTL_MS = 30 * 60 * 1000;
const clientIdentityCache = new BoundedTtlCache<string | null>(
  1_000,
  CLIENT_IDENTITY_TTL_MS
);
const pendingIdentities = new Map<string, Promise<string | null>>();

async function requestBasenames(addresses: string[]) {
  const response = await fetch(
    `/api/basenames?addresses=${encodeURIComponent(addresses.join(","))}`,
    {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    }
  );
  if (!response.ok) throw new Error("Creator names could not be loaded.");

  const payload = (await response.json()) as BasenamesResponse;
  return payload.basenames ?? {};
}

/**
 * One address-keyed client cache shared by Header, Explore and Markets.
 * Different page batches reuse both completed and in-flight resolutions, so
 * the same wallet does not create parallel Base Name requests.
 */
export async function resolveCreatorBasenames(
  values: Iterable<string | null | undefined>
) {
  const addresses = createCreatorAddressBatch(values);
  const missing = addresses.filter(
    (address) =>
      clientIdentityCache.get(address) === undefined &&
      !pendingIdentities.has(address)
  );

  if (missing.length > 0) {
    const batchRequest = requestBasenames(missing);
    for (const address of missing) {
      const addressRequest = batchRequest.then((basenames) => {
        const basename = basenames[address] ?? null;
        clientIdentityCache.set(address, basename);
        return basename;
      });
      pendingIdentities.set(address, addressRequest);
      void addressRequest.then(
        () => pendingIdentities.delete(address),
        () => pendingIdentities.delete(address)
      );
    }
  }

  const entries = await Promise.all(
    addresses.map(async (address) => {
      const cached = clientIdentityCache.get(address);
      if (cached !== undefined) return [address, cached] as const;
      return [address, (await pendingIdentities.get(address)) ?? null] as const;
    })
  );
  return Object.fromEntries(entries) as Record<string, string | null>;
}

export async function fetchCreatorBasenames(url: string) {
  const parsed = new URL(url, "http://drawcoin.local");
  const values =
    parsed.searchParams.get("addresses") ?? parsed.searchParams.get("address");
  const basenames = await resolveCreatorBasenames(values?.split(",") ?? []);
  return { basenames } satisfies BasenamesResponse;
}
