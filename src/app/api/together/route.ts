import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  void request;
  return NextResponse.json(
    {
      error: "AI drawing has been retired.",
      replacement: "/missions",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}
