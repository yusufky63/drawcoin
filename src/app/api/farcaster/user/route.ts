import { NextRequest, NextResponse } from "next/server";
import { normalizeEvmAddress } from "@/lib/api/requestValidation";
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
  const address = normalizeEvmAddress(
    request.nextUrl.searchParams.get("address")
  );
  if (!address) return json({ error: "A valid address is required." }, 422);

  const cached = profileCache.get(address);
  if (cached !== undefined) return json(cached);

  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) return json({ error: "Farcaster enrichment is not configured." }, 503);

  try {
    const upstream = new URL(
      "https://api.neynar.com/v2/farcaster/user/bulk-by-address"
    );
    upstream.searchParams.set("addresses", address);
    const response = await fetch(upstream, {
      cache: "no-store",
      headers: { accept: "application/json", api_key: apiKey },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) throw new Error(`Neynar returned ${response.status}.`);

    const data = (await response.json()) as Record<string, NeynarUser[] | undefined>;
    const user = data[address]?.[0];
    const result = user
      ? {
          user: {
            username: user.username,
            displayName: user.display_name,
            pfpUrl: user.pfp_url,
            fid: user.fid,
          },
        }
      : { user: null };
    profileCache.set(address, result);
    return json(result);
  } catch (error) {
    console.error("Farcaster profile lookup failed", error);
    return json(
      { error: "Farcaster profile is temporarily unavailable.", retryable: true },
      503
    );
  }
}
