import { NextRequest, NextResponse } from "next/server";
import { getCoinDetails } from "../../../services/sdk/getCoins.js";
import { getZoraProfile, getProfileBalance } from "../../../services/sdk/getProfiles.js";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (!action) {
      return NextResponse.json(
        { error: "Action parameter is required" },
        { status: 400 }
      );
    }


    if (action === "ethPrice") {
      // Fetch from our unified crypto-price API
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/api/crypto-price?symbol=ETH`);
        const data = await response.json();
        
        if (data.success && data.price) {
          return NextResponse.json({ price: data.price, source: data.source });
        } else if (data.fallbackPrice) {
          return NextResponse.json({ price: data.fallbackPrice, source: 'fallback' });
        }
        
        throw new Error('Failed to fetch ETH price');
      } catch (error) {
        console.error('Failed to fetch ETH price:', error);
        return NextResponse.json({ price: 3000, source: 'fallback' }); // Fallback price
      }
    }

    else if (action === "coinDetails") {
      const address = searchParams.get("address");
      if (!address) {
        return NextResponse.json(
          { error: "Address parameter is required" },
          { status: 400 }
        );
      }

      const coinData = await getCoinDetails(address);
      return NextResponse.json(coinData);
    }

    else if (action === "profile") {
      const address = searchParams.get("address");
      if (!address) {
        return NextResponse.json(
          { error: "Address parameter is required" },
          { status: 400 }
        );
      }

      const profileData = await getZoraProfile(address);
      return NextResponse.json(profileData);
    }

    else if (action === "balance") {
      const address = searchParams.get("address");
      if (!address) {
        return NextResponse.json(
          { error: "Address parameter is required" },
          { status: 400 }
        );
      }

      const balanceData = await getProfileBalance(address);
      return NextResponse.json(balanceData);
    } else {
      return NextResponse.json(
        { error: "Invalid action value" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Zora API error:", error);
    return NextResponse.json(
      { error: "An error occurred during the operation" },
      { status: 500 }
    );
  }
}
