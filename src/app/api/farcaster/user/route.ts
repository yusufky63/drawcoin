import { NextRequest, NextResponse } from "next/server";

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  const lowerAddress = address.toLowerCase();
  const now = Date.now();

  // Check cache
  if (cache.has(lowerAddress)) {
    const cached = cache.get(lowerAddress)!;
    if (now - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }
  }

  const apiKey = process.env.NEYNAR_API_KEY;

  if (!apiKey) {
    console.warn("NEYNAR_API_KEY is not set");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${address}`,
      {
        headers: {
          accept: "application/json",
          api_key: apiKey,
        },
        next: { revalidate: 1800 }, // Cache fetch for 30 mins
      }
    );

    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.statusText}`);
    }

    const data = await response.json();
    const user = data[lowerAddress]?.[0];

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

    // Update cache
    cache.set(lowerAddress, { data: result, timestamp: now });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching Farcaster user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}
