import "server-only";

import { isAddress } from "viem";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBadgeConfigurationStatus } from "@/lib/badges/config";

import type {
  BadgeClaimStatus,
  CompletedMissionForClaim,
  MissionCatalog,
  MissionMetric,
  MissionSnapshot,
} from "./types";
import { calculateMissionMetricValues } from "./metrics";

interface MissionDefinitionRow {
  id: number;
  slug: string;
  title: string;
  description: string;
  metric: MissionMetric;
  threshold: number;
  is_active: boolean;
  badge_token_id: number;
  badge_name: string;
  badge_description: string;
  badge_image_url: string | null;
}

interface UserMissionRow {
  mission_id: number;
  progress: number;
  completed_at: string | null;
}

interface UserBadgeRow {
  mission_id: number;
  earned_at: string;
  claim_status: BadgeClaimStatus;
  claim_tx_hash: string | null;
  claimed_at: string | null;
}

const TRANSACTION_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export function normalizeMissionAddress(address: string): `0x${string}` {
  if (!isAddress(address)) {
    throw new Error("Invalid wallet address");
  }

  return address.toLowerCase() as `0x${string}`;
}

function assertNoQueryError(
  context: string,
  error: { message: string } | null
): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

async function getMissionDefinitions(
  activeOnly: boolean
): Promise<MissionDefinitionRow[]> {
  let query = supabaseAdmin
    .from("mission_definitions")
    .select(
      "id, slug, title, description, metric, threshold, is_active, badge_token_id, badge_name, badge_description, badge_image_url"
    );

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const result = await query.order("sort_order", { ascending: true });

  assertNoQueryError("Unable to load mission definitions", result.error);
  return (result.data ?? []) as MissionDefinitionRow[];
}

export async function getMissionCatalog(): Promise<MissionCatalog> {
  const definitions = await getMissionDefinitions(false);
  const claiming = getBadgeConfigurationStatus();

  return {
    missions: definitions.map((mission) => ({
      id: mission.id,
      slug: mission.slug,
      title: mission.title,
      description: mission.description,
      metric: mission.metric,
      threshold: mission.threshold,
      isActive: mission.is_active,
      badge: {
        tokenId: mission.badge_token_id,
        name: mission.badge_name,
        description: mission.badge_description,
        imageUrl: mission.badge_image_url,
      },
    })),
    claiming: claiming.configured
      ? {
          configured: true,
          chainId: claiming.chainId,
          contractAddress: claiming.contractAddress,
        }
      : { configured: false },
  };
}

async function getMetricValues(
  address: `0x${string}`
): Promise<{
  verified: Record<MissionMetric, number>;
  legacy: Record<MissionMetric, number>;
}> {
  const [verifiedCreationsResult, transactionsResult, watchlistResult, legacyWatchlistResult] =
    await Promise.all([
      supabaseAdmin
        .from("drawcoins")
        .select("created_at")
        .ilike("creator_address", address)
        .not("verified_at", "is", null),
      supabaseAdmin
        .from("transactions")
        .select("type, timestamp")
        .ilike("user_address", address)
        .not("verified_at", "is", null),
      supabaseAdmin
        .from("watchlists")
        .select("id", { count: "exact", head: true })
        .ilike("user_address", address)
        .not("verified_at", "is", null),
      supabaseAdmin
        .from("watchlists")
        .select("id", { count: "exact", head: true })
        .ilike("user_address", address)
        .is("verified_at", null),
    ]);

  assertNoQueryError(
    "Unable to count verified creations",
    verifiedCreationsResult.error
  );
  assertNoQueryError(
    "Unable to load verified transactions",
    transactionsResult.error
  );
  assertNoQueryError(
    "Unable to count distinct watchlist tokens",
    watchlistResult.error
  );
  assertNoQueryError(
    "Unable to count legacy watchlist tokens",
    legacyWatchlistResult.error
  );

  return {
    verified: calculateMissionMetricValues({
      verifiedCreationDates: (verifiedCreationsResult.data ?? []).map(
        (row) => row.created_at ?? null
      ),
      verifiedTransactions: (transactionsResult.data ?? []).map((row) => ({
        type: row.type ?? null,
        timestamp: row.timestamp ?? null,
      })),
      verifiedWatchlistCount: watchlistResult.count ?? 0,
    }),
    legacy: {
      verified_creation: 0,
      verified_buy: 0,
      watchlist_token: legacyWatchlistResult.count ?? 0,
      ecosystem_role: 0,
      verified_activity_day: 0,
    },
  };
}

export async function evaluateMissions(
  walletAddress: string
): Promise<MissionSnapshot> {
  const address = normalizeMissionAddress(walletAddress);

  const [definitionsResult, existingProgressResult, metricValues] =
    await Promise.all([
      getMissionDefinitions(true),
      supabaseAdmin
        .from("user_missions")
        .select("mission_id, progress, completed_at")
        .eq("address", address),
      getMetricValues(address),
    ]);

  assertNoQueryError(
    "Unable to load mission progress",
    existingProgressResult.error
  );

  const definitions = definitionsResult;
  const existingProgress = (existingProgressResult.data ?? []) as UserMissionRow[];
  const progressByMissionId = new Map(
    existingProgress.map((row) => [row.mission_id, row])
  );
  const evaluatedAt = new Date().toISOString();
  const hasMissionActivity = Object.values(metricValues.verified).some(
    (value) => value > 0
  );
  const shouldPersistProgress =
    existingProgress.length > 0 || hasMissionActivity;

  const progressRows = definitions.map((mission) => {
    const previous = progressByMissionId.get(mission.id);
    const measuredProgress = metricValues.verified[mission.metric];
    const completedAt =
      previous?.completed_at ??
      (measuredProgress >= mission.threshold ? evaluatedAt : null);

    return {
      address,
      mission_id: mission.id,
      progress: completedAt
        ? Math.max(measuredProgress, mission.threshold)
        : measuredProgress,
      completed_at: completedAt,
      updated_at: evaluatedAt,
    };
  });

  if (shouldPersistProgress && progressRows.length > 0) {
    const upsertResult = await supabaseAdmin
      .from("user_missions")
      .upsert(progressRows, { onConflict: "address,mission_id" });

    assertNoQueryError("Unable to save mission progress", upsertResult.error);
  }

  const earnedBadgeRows = progressRows
    .filter((row) => row.completed_at !== null)
    .map((row) => ({
      address,
      mission_id: row.mission_id,
      earned_at: row.completed_at as string,
      updated_at: evaluatedAt,
    }));

  if (shouldPersistProgress && earnedBadgeRows.length > 0) {
    const badgeInsertResult = await supabaseAdmin
      .from("user_badges")
      .upsert(earnedBadgeRows, {
        onConflict: "address,mission_id",
        ignoreDuplicates: true,
      });

    assertNoQueryError("Unable to award mission badges", badgeInsertResult.error);
  }

  const badgeResult = await supabaseAdmin
    .from("user_badges")
    .select(
      "mission_id, earned_at, claim_status, claim_tx_hash, claimed_at"
    )
    .eq("address", address);

  assertNoQueryError("Unable to load mission badges", badgeResult.error);

  const badges = (badgeResult.data ?? []) as UserBadgeRow[];
  const badgeByMissionId = new Map(
    badges.map((badge) => [badge.mission_id, badge])
  );

  return {
    address,
    missions: definitions.map((mission) => {
      const progressRow = progressRows.find(
        (row) => row.mission_id === mission.id
      );
      const badge = badgeByMissionId.get(mission.id);
      const completedAt = progressRow?.completed_at ?? null;

      return {
        id: mission.id,
        slug: mission.slug,
        title: mission.title,
        description: mission.description,
        metric: mission.metric,
        progress: progressRow?.progress ?? 0,
        legacyProgress: metricValues.legacy[mission.metric],
        threshold: mission.threshold,
        isCompleted: completedAt !== null,
        completedAt,
        isActive: true,
        badge: {
          tokenId: mission.badge_token_id,
          name: mission.badge_name,
          description: mission.badge_description,
          imageUrl: mission.badge_image_url,
          earnedAt: badge?.earned_at ?? null,
          claimStatus: badge?.claim_status ?? null,
          claimTxHash: badge?.claim_tx_hash ?? null,
          claimedAt: badge?.claimed_at ?? null,
        },
      };
    }),
  };
}

export async function getCompletedMissionForAddress(
  walletAddress: string,
  missionSlug: string
): Promise<CompletedMissionForClaim | null> {
  const snapshot = await evaluateMissions(walletAddress);
  const mission = snapshot.missions.find(
    (candidate) => candidate.slug === missionSlug && candidate.isCompleted
  );

  if (!mission || !mission.completedAt) {
    return null;
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

export async function reconcileCompletedBadgeClaim(
  walletAddress: string,
  completedMission: CompletedMissionForClaim,
  options: {
    transactionHash?: string;
    reserveNotification: boolean;
  }
): Promise<{ newlyClaimed: boolean; shouldNotify: boolean }> {
  const transactionHash = options.transactionHash?.trim();
  if (transactionHash && !TRANSACTION_HASH_PATTERN.test(transactionHash)) {
    throw new Error("Invalid badge claim transaction hash");
  }

  const address = normalizeMissionAddress(walletAddress);
  const normalizedTransactionHash = transactionHash?.toLowerCase();
  const claimedAt = new Date().toISOString();
  const claimUpdateResult = await supabaseAdmin
    .from("user_badges")
    .update({
      claim_status: "claimed",
      claimed_at: claimedAt,
      ...(normalizedTransactionHash
        ? { claim_tx_hash: normalizedTransactionHash }
        : {}),
      updated_at: claimedAt,
    })
    .eq("address", address)
    .eq("mission_id", completedMission.missionId)
    .neq("claim_status", "claimed")
    .select("id")
    .maybeSingle();

  assertNoQueryError(
    "Unable to reconcile badge claim",
    claimUpdateResult.error
  );

  const newlyClaimed = Boolean(claimUpdateResult.data);
  if (!newlyClaimed) {
    const existingResult = await supabaseAdmin
      .from("user_badges")
      .select("id, claim_status")
      .eq("address", address)
      .eq("mission_id", completedMission.missionId)
      .maybeSingle();

    assertNoQueryError(
      "Unable to verify reconciled badge claim",
      existingResult.error
    );
    if (!existingResult.data) {
      throw new Error("Badge record was not found");
    }
    if (existingResult.data.claim_status !== "claimed") {
      throw new Error("Badge claim could not be reconciled");
    }
  }

  // A GET reconciliation may win the race before the confirming POST arrives.
  // Fill the receipt hash later, but never replace a hash already recorded.
  if (normalizedTransactionHash) {
    const hashUpdateResult = await supabaseAdmin
      .from("user_badges")
      .update({
        claim_tx_hash: normalizedTransactionHash,
        updated_at: new Date().toISOString(),
      })
      .eq("address", address)
      .eq("mission_id", completedMission.missionId)
      .eq("claim_status", "claimed")
      .is("claim_tx_hash", null);

    assertNoQueryError(
      "Unable to record badge claim transaction",
      hashUpdateResult.error
    );
  }

  if (!options.reserveNotification) {
    return { newlyClaimed, shouldNotify: false };
  }

  // PostgreSQL re-checks the NULL predicate after a concurrent row lock is
  // released, so only one request can reserve the notification attempt.
  const notificationAttemptedAt = new Date().toISOString();
  const notificationReservationResult = await supabaseAdmin
    .from("user_badges")
    .update({
      notification_attempted_at: notificationAttemptedAt,
      updated_at: notificationAttemptedAt,
    })
    .eq("address", address)
    .eq("mission_id", completedMission.missionId)
    .eq("claim_status", "claimed")
    .is("notification_attempted_at", null)
    .select("id")
    .maybeSingle();

  assertNoQueryError(
    "Unable to reserve badge notification",
    notificationReservationResult.error
  );

  return {
    newlyClaimed,
    shouldNotify: Boolean(notificationReservationResult.data),
  };
}

async function updateBadgeClaimPending(
  walletAddress: string,
  missionSlug: string,
  transactionHash: string
): Promise<void> {
  if (!TRANSACTION_HASH_PATTERN.test(transactionHash)) {
    throw new Error("Invalid badge claim transaction hash");
  }

  const address = normalizeMissionAddress(walletAddress);
  const completedMission = await getCompletedMissionForAddress(
    address,
    missionSlug
  );

  if (!completedMission) {
    throw new Error("Mission has not been completed");
  }

  const now = new Date().toISOString();
  const updateResult = await supabaseAdmin
    .from("user_badges")
    .update({
      claim_status: "pending",
      claim_tx_hash: transactionHash.toLowerCase(),
      claimed_at: null,
      updated_at: now,
    })
    .eq("address", address)
    .eq("mission_id", completedMission.missionId)
    .neq("claim_status", "claimed")
    .select("id")
    .maybeSingle();

  assertNoQueryError("Unable to update badge claim", updateResult.error);

  if (!updateResult.data) {
    const existingResult = await supabaseAdmin
      .from("user_badges")
      .select("id, claim_status")
      .eq("address", address)
      .eq("mission_id", completedMission.missionId)
      .maybeSingle();

    assertNoQueryError("Unable to verify badge claim", existingResult.error);
    if (!existingResult.data) throw new Error("Badge record was not found");
    if (existingResult.data.claim_status !== "claimed") {
      throw new Error("Unable to mark badge claim as pending");
    }
  }
}

export async function markBadgeClaimPending(
  walletAddress: string,
  missionSlug: string,
  transactionHash: string
): Promise<void> {
  return updateBadgeClaimPending(walletAddress, missionSlug, transactionHash);
}

export async function markBadgeClaimed(
  walletAddress: string,
  missionSlug: string,
  transactionHash: string
): Promise<void> {
  const completedMission = await getCompletedMissionForAddress(
    walletAddress,
    missionSlug
  );
  if (!completedMission) throw new Error("Mission has not been completed");

  await reconcileCompletedBadgeClaim(walletAddress, completedMission, {
    transactionHash,
    reserveNotification: false,
  });
}
