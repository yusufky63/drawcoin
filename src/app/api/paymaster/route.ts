import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { method, params, id } = body;

    // Use the Paymaster URL from environment variables
    // Prefer server-side only variable if available, otherwise fall back to public
    const paymasterUrl =
      process.env.PAYMASTER_SERVICE_URL ||
      process.env.NEXT_PUBLIC_PAYMASTER_URL;

    if (!paymasterUrl) {
      return NextResponse.json(
        { error: "Paymaster URL not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(paymasterUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ method, params, id, jsonrpc: "2.0" }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Paymaster Proxy Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
