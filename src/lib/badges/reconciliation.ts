import "server-only";

import type { Hex } from "viem";

import { sendMissionBadgeNotification, getBaseNotificationConfigurationStatus } from "@/lib/baseNotifications";
import {
  evaluateMissions,
  reconcileCompletedBadgeClaim,
} from "@/lib/missions/service";
import type {
  CompletedMissionForClaim,
  MissionProgress,
  MissionSnapshot,
} from "@/lib/missions/types";

import {
  readBadgeClaimStates,
  readBadgeReconciliationState,
} from "./chainReads";
import {
  getBadgeConfigurationStatus,
  getBadgeRuntimeConfig,
} from "./config";
import {
  applyCanonicalBadgeClaim,
  type CanonicalBadgeClaimResult,
} from "./reconciliationPolicy";

function completedMissionForClaim(
  mission: MissionProgress
): CompletedMissionForClaim {
  if (!mission.completedAt) {
    throw new Error("Mission has not been completed");
  }

  return {
    missionId: mission.id,
    slug: mission.slug,
    completedAt: mission.completedAt,
    badge: {
      tokenId: mission.badge.tokenId,
      name: mission.badge.name,
      description: mission.badge.description,
      imageUrl: mission.badge.imageUrl,
    },
  };
}

async function persistCanonicalClaim(input: {
  address: `0x${string}`;
  mission: CompletedMissionForClaim;
  onchainClaimed: boolean;
  transactionHash?: Hex;
}): Promise<CanonicalBadgeClaimResult> {
  const notificationsConfigured =
    getBaseNotificationConfigurationStatus().configured;

  return applyCanonicalBadgeClaim(
    {
      onchainClaimed: input.onchainClaimed,
      notificationsConfigured,
    },
    {
      persist: ({ reserveNotification }) =>
        reconcileCompletedBadgeClaim(input.address, input.mission, {
          transactionHash: input.transactionHash,
          reserveNotification,
        }),
      notify: async () => {
        const delivery = await sendMissionBadgeNotification(
          input.address,
          input.mission.badge.name
        );
        return { delivered: delivery.delivered };
      },
    }
  );
}

export async function reconcileOnchainBadgeClaim(input: {
  address: `0x${string}`;
  mission: CompletedMissionForClaim;
  transactionHash?: Hex;
}) {
  const config = getBadgeRuntimeConfig();
  const tokenId = BigInt(input.mission.badge.tokenId);
  const { claimed, balance, nonce } = await readBadgeReconciliationState(
    config,
    input.address,
    tokenId
  );
  const reconciliation = await persistCanonicalClaim({
    ...input,
    onchainClaimed: claimed,
  });

  return {
    chainId: config.chainId,
    contractAddress: config.contractAddress,
    claimed,
    balance,
    nonce,
    newlyClaimed: reconciliation.newlyClaimed,
    notification: reconciliation.notification,
  };
}

/**
 * Reconciles only completed badges whose local state is not yet claimed. These
 * are targeted contract storage reads; the request never scans historical logs.
 */
export async function reconcileMissionSnapshotOnchain(
  snapshot: MissionSnapshot
): Promise<MissionSnapshot> {
  if (!getBadgeConfigurationStatus().configured) return snapshot;

  const candidates = snapshot.missions.filter(
    (mission) =>
      mission.isCompleted &&
      mission.completedAt !== null &&
      mission.badge.claimStatus !== "claimed"
  );
  if (candidates.length === 0) return snapshot;

  const config = getBadgeRuntimeConfig();
  let claimedStates: readonly boolean[];
  try {
    claimedStates = await readBadgeClaimStates(
      config,
      snapshot.address,
      candidates.map((mission) => BigInt(mission.badge.tokenId))
    );
  } catch {
    // Mission progress is canonical in Supabase. Onchain reconciliation is a
    // recovery aid and must never make the whole mission catalog unavailable.
    console.warn("Badge claim reconciliation deferred because Base RPC is unavailable.");
    return snapshot;
  }
  const claimedMissions = candidates.filter(
    (_mission, index) => claimedStates[index]
  );
  if (claimedMissions.length === 0) return snapshot;

  await Promise.all(
    claimedMissions.map((mission) =>
      persistCanonicalClaim({
        address: snapshot.address,
        mission: completedMissionForClaim(mission),
        onchainClaimed: true,
      })
    )
  );

  return evaluateMissions(snapshot.address);
}
