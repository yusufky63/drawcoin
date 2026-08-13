import { NextResponse } from "next/server";

import { getMissionCatalog } from "@/lib/missions/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const catalog = await getMissionCatalog();

    return NextResponse.json(catalog, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Failed to load mission catalog", error);
    return NextResponse.json(
      { error: "MISSION_CATALOG_UNAVAILABLE" },
      { status: 503 }
    );
  }
}
