import { NextRequest, NextResponse } from "next/server";
import { getCoinDetails } from "../../../services/sdk/getCoins.js";
import { getZoraProfile, getProfileBalance } from "../../../services/sdk/getProfiles.js";

import { getETHPrice } from "../../../services/ethPrice.js";

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

    // ETH fiyatını getir
    if (action === "ethPrice") {
      const price = await getETHPrice();
      return NextResponse.json({ price });
    }

    // Coin detaylarını getir
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

    // Profil bilgilerini getir
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

    // Profil bakiyesini getir
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
