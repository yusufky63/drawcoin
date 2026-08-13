import { NextRequest, NextResponse } from "next/server";
import {
  decodeEventLog,
  getAddress,
  isAddressEqual,
  type Hex,
} from "viem";
import { SessionError, requireWalletSession } from "@/lib/auth/session";
import { drawCoinMissionBadgesAbi } from "@/lib/badges/abi";
import {
  BadgeConfigurationError,
  getBadgeConfigurationStatus,
  getBadgeRuntimeConfig,
} from "@/lib/badges/config";
import { reconcileOnchainBadgeClaim } from "@/lib/badges/reconciliation";
import {
  getCompletedMissionForAddress,
  markBadgeClaimPending,
} from "@/lib/missions/service";

export const dynamic = "force-dynamic";

const MISSION_SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;
const TRANSACTION_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function missionSlugFromRequest(request: NextRequest): string | null {
  const missionSlug = request.nextUrl.searchParams.get("mission")?.trim() || "";
  return MISSION_SLUG_PATTERN.test(missionSlug) ? missionSlug : null;
}

function sessionErrorResponse(error: SessionError) {
  return NextResponse.json(
    { error: error.message },
    { status: error.status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireWalletSession();
    const missionSlug = missionSlugFromRequest(request);
    if (!missionSlug) {
      return NextResponse.json(
        { error: "A valid mission query parameter is required." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const completedMission = await getCompletedMissionForAddress(
      session.address,
      missionSlug
    );
    if (!completedMission) {
      return NextResponse.json(
        { eligible: false, claimed: false },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const configurationStatus = getBadgeConfigurationStatus();
    if (!configurationStatus.configured) {
      return NextResponse.json(
        {
          eligible: true,
          claimed: false,
          onchainEnabled: false,
          reason: configurationStatus.reason,
        },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const state = await reconcileOnchainBadgeClaim({
      address: session.address,
      mission: completedMission,
    });

    return NextResponse.json(
      {
        eligible: true,
        onchainEnabled: true,
        claimed: state.claimed,
        balance: state.balance.toString(),
        nonce: state.nonce.toString(),
        chainId: state.chainId,
        contractAddress: state.contractAddress,
        badge: completedMission.badge,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof SessionError) return sessionErrorResponse(error);
    if (error instanceof BadgeConfigurationError) {
      return NextResponse.json(
        { error: "Onchain badge claiming is not configured.", detail: error.message },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { error: "Unable to read badge claim status." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireWalletSession();
    const body = (await request.json()) as {
      missionSlug?: unknown;
      transactionHash?: unknown;
    };
    const missionSlug =
      typeof body.missionSlug === "string" ? body.missionSlug.trim() : "";
    const transactionHash =
      typeof body.transactionHash === "string" ? body.transactionHash.trim() : "";

    if (
      !MISSION_SLUG_PATTERN.test(missionSlug) ||
      !TRANSACTION_HASH_PATTERN.test(transactionHash)
    ) {
      return NextResponse.json(
        { error: "A valid mission slug and transaction hash are required." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const completedMission = await getCompletedMissionForAddress(
      session.address,
      missionSlug
    );
    if (!completedMission) {
      return NextResponse.json(
        { error: "Complete this mission before confirming its badge." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const config = getBadgeRuntimeConfig();
    let receipt;
    try {
      receipt = await config.publicClient.getTransactionReceipt({
        hash: transactionHash as Hex,
      });
    } catch {
      await markBadgeClaimPending(
        session.address,
        missionSlug,
        transactionHash
      );
      return NextResponse.json(
        { confirmed: false, pending: true },
        { status: 202, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    if (receipt.status !== "success") {
      return NextResponse.json(
        { error: "The badge claim transaction reverted.", confirmed: false },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    const expectedAccount = getAddress(session.address);
    const expectedTokenId = BigInt(completedMission.badge.tokenId);
    const matchingLog = receipt.logs.some((log) => {
      if (!isAddressEqual(log.address, config.contractAddress)) return false;

      try {
        const decoded = decodeEventLog({
          abi: drawCoinMissionBadgesAbi,
          eventName: "BadgeClaimed",
          data: log.data,
          topics: log.topics,
        });
        return (
          isAddressEqual(decoded.args.account, expectedAccount) &&
          decoded.args.tokenId === expectedTokenId
        );
      } catch {
        return false;
      }
    });

    if (!matchingLog) {
      return NextResponse.json(
        { error: "This transaction did not claim the requested mission badge." },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    const state = await reconcileOnchainBadgeClaim({
      address: session.address,
      mission: completedMission,
      transactionHash: transactionHash as Hex,
    });
    if (!state.claimed) {
      return NextResponse.json(
        { error: "The badge claim is not present in canonical contract state." },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        confirmed: true,
        claimed: true,
        transactionHash: transactionHash.toLowerCase(),
        badge: completedMission.badge,
        notification: state.notification,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof SessionError) return sessionErrorResponse(error);
    if (error instanceof BadgeConfigurationError) {
      return NextResponse.json(
        { error: "Onchain badge claiming is not configured.", detail: error.message },
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
      { error: "Unable to verify the badge claim transaction." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
