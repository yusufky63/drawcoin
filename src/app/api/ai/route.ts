import { NextRequest, NextResponse } from "next/server";

function retiredResponse() {
  return NextResponse.json(
    {
      error: "AI drawing has been retired.",
      replacement: "/missions",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  void request;
  return retiredResponse();
}

export async function OPTIONS() {
  return retiredResponse();
}
