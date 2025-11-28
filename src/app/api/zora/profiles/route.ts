import { NextRequest, NextResponse } from "next/server";
import { getZoraProfilesBulk } from "@/services/sdk/getProfiles.js";

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

  try {
    // Fetch missing profiles
    // We limit concurrency to 5 in the SDK function
    const fetchedProfiles = (await getZoraProfilesBulk(
      missingAddresses
    )) as Record<string, any>;

    // Update result and cache
    for (const addr of missingAddresses) {
      const profile = fetchedProfiles[addr];

      // We cache even null results to avoid repeated failed fetches
      cache.set(addr, { data: profile || null, timestamp: now });

      if (profile) {
        result[addr] = profile;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching Zora profiles:", error);
    // Return partial results if possible
    return NextResponse.json(result);
  }
}
