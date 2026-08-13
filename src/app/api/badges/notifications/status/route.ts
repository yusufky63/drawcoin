import { NextResponse } from "next/server";
import { SessionError, requireWalletSession } from "@/lib/auth/session";
import {
  BaseNotificationError,
  getBaseNotificationUserStatus,
} from "@/lib/baseNotifications";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireWalletSession();
    const status = await getBaseNotificationUserStatus(session.address);
    return NextResponse.json(status, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (error instanceof BaseNotificationError) {
      return NextResponse.json(
        { error: error.message, retryable: error.retryable },
        { status: error.status, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { error: "Unable to read Base notification preferences." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
