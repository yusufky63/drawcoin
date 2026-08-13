import { NextRequest, NextResponse } from "next/server";
import { ApiInputError, parseAddressList } from "@/lib/api/requestValidation";
import { BoundedTtlCache } from "@/lib/server/boundedTtlCache";
import { getZoraProfilesBulk } from "@/services/sdk/getProfiles.js";

export const dynamic = "force-dynamic";

const profileCache = new BoundedTtlCache<unknown>(500, 30 * 60 * 1000);

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": status === 200 ? "public, s-maxage=300" : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: NextRequest) {
  let addresses: string[];
  try {
    addresses = parseAddressList(
      request.nextUrl.searchParams.get("addresses"),
      25
    );
  } catch (error) {
    if (error instanceof ApiInputError) return json({ error: error.message }, error.status);
    return json({ error: "Invalid request." }, 400);
  }

  const result: Record<string, unknown> = {};
  const missingAddresses: string[] = [];
  for (const address of addresses) {
    const cached = profileCache.get(address);
    if (cached !== undefined) result[address] = cached;
    else missingAddresses.push(address);
  }

  if (missingAddresses.length === 0) return json(result);

  try {
    const fetched = (await getZoraProfilesBulk(
      missingAddresses,
      3,
      { maxRetries: 2, baseRetryDelay: 500, throwIfAllFailed: true }
    )) as Record<string, unknown>;

    for (const address of missingAddresses) {
      const profile = fetched[address] ?? null;
      profileCache.set(address, profile);
      result[address] = profile;
    }
    return json(result);
  } catch (error) {
    console.error("Zora profile enrichment failed", error);
    return json(
      {
        error: "Zora profiles are temporarily unavailable.",
        retryable: true,
      },
      503
    );
  }
}
