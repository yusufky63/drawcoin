import { NextRequest, NextResponse } from "next/server";
import { ApiInputError, parseAddressList } from "@/lib/api/requestValidation";
import { BoundedTtlCache } from "@/lib/server/boundedTtlCache";

export const dynamic = "force-dynamic";

interface NeynarUser {
  username?: string;
  display_name?: string;
  pfp_url?: string;
  fid?: number;
}
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
      50
    );
  } catch (error) {
    if (error instanceof ApiInputError) return json({ error: error.message }, error.status);
    return json({ error: "Invalid request." }, 400);
  }

  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    return json({ error: "Farcaster enrichment is not configured." }, 503);
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
    const upstream = new URL(
      "https://api.neynar.com/v2/farcaster/user/bulk-by-address"
    );
    upstream.searchParams.set("addresses", missingAddresses.join(","));
    const response = await fetch(upstream, {
      cache: "no-store",
      headers: { accept: "application/json", api_key: apiKey },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) throw new Error(`Neynar returned ${response.status}.`);

    const data = (await response.json()) as Record<string, NeynarUser[] | undefined>;
    for (const address of missingAddresses) {
      const user = data[address]?.[0];
      const profile = user
        ? {
            username: user.username,
            displayName: user.display_name,
            pfpUrl: user.pfp_url,
            fid: user.fid,
          }
        : null;
      profileCache.set(address, profile);
      result[address] = profile;
    }
    return json(result);
  } catch (error) {
    console.error("Farcaster profile enrichment failed", error);
    return json(
      { error: "Farcaster profiles are temporarily unavailable.", retryable: true },
      503
    );
  }
}
