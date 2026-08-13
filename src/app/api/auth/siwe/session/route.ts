import { NextResponse } from "next/server";
import {
  clearWalletSession,
  getWalletSession,
  SessionError,
} from "@/lib/auth/session";

export async function GET() {
  try {
    const session = await getWalletSession();
    const response = NextResponse.json({ session });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof SessionError) {
      await clearWalletSession();
      return NextResponse.json(
        { session: null, error: error.code },
        { status: error.status, headers: { "Cache-Control": "no-store" } }
      );
    }
    throw error;
  }
}

export async function DELETE() {
  await clearWalletSession();
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
