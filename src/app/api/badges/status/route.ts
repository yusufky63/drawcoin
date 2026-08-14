import { NextRequest, NextResponse } from "next/server";
import {
  decodeEventLog,
  getAddress,
  isAddressEqual,
  type Hex,
} from "viem";
import { drawCoinMissionBadgesAbi } from "@/lib/badges/abi";
import {
  BadgeConfigurationError,
  BadgeRpcUnavailableError,
  getBadgeConfigurationStatus,
  getBadgeRuntimeConfig,
} from "@/lib/badges/config";
import { reconcileOnchainBadgeClaim } from "@/lib/badges/reconciliation";
import {
  getCompletedMissionForAddress,
  markBadgeClaimPending,
} from "@/lib/missions/service";
import { parseMissionRequestAddress } from "@/lib/missions/requestAddress";

export const dynamic = "force-dynamic";

const MISSION_SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;
const TRANSACTION_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function missionSlugFromRequest(request: NextRequest): string | null {
  const missionSlug = request.nextUrl.searchParams.get("mission")?.trim() || "";
  return MISSION_SLUG_PATTERN.test(missionSlug) ? missionSlug : null;
}

export async function GET(request: NextRequest) {
  try {
    const address = parseMissionRequestAddress(
      request.nextUrl.searchParams.get("address")
    );
    const missionSlug = missionSlugFromRequest(request);
    if (!address || !missionSlug) {
      return NextResponse.json(
        { error: "A valid wallet address and mission query are required." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const completedMission = await getCompletedMissionForAddress(
      address,
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
      address,
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
    if (error instanceof BadgeConfigurationError) {
      return NextResponse.json(
        { error: "Onchain badge claiming is not configured.", detail: error.message },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (error instanceof BadgeRpcUnavailableError) {
      return NextResponse.json(
        { error: "Badge status is temporarily unavailable." },
        {
          status: 503,
          headers: { "Cache-Control": "no-store", "Retry-After": "3" },
        }
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
    const body = (await request.json()) as {
      address?: unknown;
      missionSlug?: unknown;
      transactionHash?: unknown;
    };
    const address = parseMissionRequestAddress(body.address);
    const missionSlug =
      typeof body.missionSlug === "string" ? body.missionSlug.trim() : "";
    const transactionHash =
      typeof body.transactionHash === "string" ? body.transactionHash.trim() : "";

    if (
      !address ||
      !MISSION_SLUG_PATTERN.test(missionSlug) ||
      !TRANSACTION_HASH_PATTERN.test(transactionHash)
    ) {
      return NextResponse.json(
        {
          error:
            "A valid wallet address, mission slug, and transaction hash are required.",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const completedMission = await getCompletedMissionForAddress(
      address,
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
        address,
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

    const expectedAccount = getAddress(address);
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
      address,
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
    if (error instanceof BadgeConfigurationError) {
      return NextResponse.json(
        { error: "Onchain badge claiming is not configured.", detail: error.message },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (error instanceof BadgeRpcUnavailableError) {
      return NextResponse.json(
        { error: "Badge confirmation is temporarily unavailable." },
        {
          status: 503,
          headers: { "Cache-Control": "no-store", "Retry-After": "3" },
        }
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
