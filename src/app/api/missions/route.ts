import { NextResponse } from "next/server";

import {
  requireWalletSession,
  SessionError,
} from "@/lib/auth/session";
import { reconcileMissionSnapshotOnchain } from "@/lib/badges/reconciliation";
import { evaluateMissions } from "@/lib/missions/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireWalletSession();
    const snapshot = await evaluateMissions(session.address);
    const reconciledSnapshot = await reconcileMissionSnapshotOnchain(snapshot);

    return NextResponse.json(reconciledSnapshot, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.status }
      );
    }

    console.error("Failed to evaluate missions", error);
    return NextResponse.json(
      { error: "MISSIONS_UNAVAILABLE" },
      { status: 500 }
    );
  }
}
