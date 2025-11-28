import { NextRequest, NextResponse } from "next/server";

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const addresses = searchParams.get("addresses");

  if (!addresses) {
    return NextResponse.json(
      { error: "Addresses are required" },
      { status: 400 }
    );
  }

  const addressList = addresses.split(",").map((a) => a.trim().toLowerCase());

  if (addressList.length === 0) {
    return NextResponse.json({});
  }

  const now = Date.now();
  const result: Record<string, any> = {};
  const missingAddresses: string[] = [];

  // Check cache first
  for (const addr of addressList) {
    if (cache.has(addr)) {
      const cached = cache.get(addr)!;
      if (now - cached.timestamp < CACHE_TTL) {
        result[addr] = cached.data;
      } else {
        missingAddresses.push(addr);
      }
    } else {
      missingAddresses.push(addr);
    }
  }

  // If all found in cache, return
  if (missingAddresses.length === 0) {
    return NextResponse.json(result);
  }

  const apiKey = process.env.NEYNAR_API_KEY;

  if (!apiKey) {
    console.warn("NEYNAR_API_KEY is not set");
    // Return what we have from cache if API key is missing
    return NextResponse.json(result);
  }

  try {
    // Fetch missing addresses in chunks of 50 (API limit usually)
    const chunkSize = 50;
    for (let i = 0; i < missingAddresses.length; i += chunkSize) {
      const chunk = missingAddresses.slice(i, i + chunkSize);
      const addressesParam = chunk.join(",");

      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${addressesParam}`,
        {
          headers: {
            accept: "application/json",
            api_key: apiKey,
          },
          next: { revalidate: 1800 },
        }
      );

      if (!response.ok) {
        console.error(`Neynar API error: ${response.statusText}`);
        continue;
      }

      const data = await response.json();

      // Process response
      for (const addr of chunk) {
        const user = data[addr]?.[0];
        const userData = user
          ? {
              username: user.username,
              displayName: user.display_name,
              pfpUrl: user.pfp_url,
              fid: user.fid,
            }
          : null;

        // Update result and cache
        result[addr] = userData;
        cache.set(addr, { data: userData, timestamp: now });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching Farcaster users:", error);
    // Return partial results if possible
    return NextResponse.json(result);
  }
}
