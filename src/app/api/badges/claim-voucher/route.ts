import { NextRequest, NextResponse } from "next/server";
import { SessionError, requireWalletSession } from "@/lib/auth/session";
import {
  BadgeConfigurationError,
  getBadgeConfigurationStatus,
} from "@/lib/badges/config";
import {
  BadgeAlreadyClaimedError,
  createBadgeClaimVoucher,
  createPaymasterGrantToken,
  getPaymasterConfigurationStatus,
} from "@/lib/badges/voucher";
import { getCompletedMissionForAddress } from "@/lib/missions/service";

export const dynamic = "force-dynamic";

const MISSION_SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

export async function POST(request: NextRequest) {
  try {
    const session = await requireWalletSession();
    const body = (await request.json()) as { missionSlug?: unknown };
    const missionSlug =
      typeof body.missionSlug === "string" ? body.missionSlug.trim() : "";

    if (!MISSION_SLUG_PATTERN.test(missionSlug)) {
      return NextResponse.json(
        { error: "A valid mission slug is required." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const completedMission = await getCompletedMissionForAddress(
      session.address,
      missionSlug
    );
    if (!completedMission) {
      return NextResponse.json(
        { error: "Complete this mission before claiming its badge." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const badgeMetadataReady = Boolean(
      Number.isSafeInteger(completedMission.badge.tokenId) &&
        completedMission.badge.tokenId >= 0 &&
        completedMission.badge.name.trim() &&
        completedMission.badge.description.trim() &&
        completedMission.badge.imageUrl?.trim()
    );
    if (!badgeMetadataReady) {
      return NextResponse.json(
        { error: "This badge's deployable metadata is not ready yet." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const tokenId = BigInt(completedMission.badge.tokenId);
    const voucher = await createBadgeClaimVoucher(session.address, tokenId);
    const paymasterGrantToken = await createPaymasterGrantToken(voucher);
    const paymasterStatus = getPaymasterConfigurationStatus();

    let paymaster:
      | { enabled: true; url: string }
      | { enabled: false; reason: string };
    if (paymasterGrantToken) {
      const proxyUrl = new URL("/api/paymaster", request.url);
      proxyUrl.searchParams.set("token", paymasterGrantToken);
      paymaster = { enabled: true, url: proxyUrl.toString() };
    } else {
      paymaster = {
        enabled: false,
        reason:
          paymasterStatus.configured === false
            ? paymasterStatus.reason
            : "Gas sponsorship is not available.",
      };
    }

    return NextResponse.json(
      {
        mission: {
          slug: completedMission.slug,
          badge: completedMission.badge,
        },
        claim: {
          account: voucher.account,
          tokenId: voucher.tokenId.toString(),
          nonce: voucher.nonce.toString(),
          deadline: voucher.deadline.toString(),
          signature: voucher.signature,
          to: voucher.contractAddress,
          data: voucher.callData,
          value: "0x0",
          chainId: voucher.chainId,
        },
        paymaster,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (error instanceof BadgeAlreadyClaimedError) {
      return NextResponse.json(
        { error: error.message, alreadyClaimed: true },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (error instanceof BadgeConfigurationError) {
      return NextResponse.json(
        {
          error: "Onchain badge claiming is not configured.",
          detail: error.message,
          configuration: getBadgeConfigurationStatus(),
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { error: "Unable to create a badge claim voucher." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
