import { NextRequest, NextResponse } from "next/server";
import { reconcileMissionSnapshotOnchain } from "@/lib/badges/reconciliation";
import { parseMissionRequestAddress } from "@/lib/missions/requestAddress";
import { evaluateMissions } from "@/lib/missions/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const address = parseMissionRequestAddress(
      request.nextUrl.searchParams.get("address")
    );
    if (!address) {
      return NextResponse.json(
        { error: "A valid wallet address is required." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const snapshot = await evaluateMissions(address);
    const reconciledSnapshot = await reconcileMissionSnapshotOnchain(snapshot);

    return NextResponse.json(reconciledSnapshot, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to evaluate missions", error);
    return NextResponse.json(
      { error: "MISSIONS_UNAVAILABLE" },
      { status: 500 }
    );
  }
}
