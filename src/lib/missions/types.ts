export type MissionMetric =
  | "verified_creation"
  | "verified_buy"
  | "watchlist_token"
  | "ecosystem_role"
  | "verified_activity_day"
  | "verified_trade"
  | "distinct_collected_coin"
  | "round_trip_token"
  | "verified_trade_day"
  | "completed_standard_mission";

export type BadgeClaimStatus =
  | "unclaimed"
  | "pending"
  | "claimed"
  | "failed";

export interface MissionBadge {
  tokenId: number;
  name: string;
  description: string;
  imageUrl: string | null;
  earnedAt: string | null;
  claimStatus: BadgeClaimStatus | null;
  claimTxHash: string | null;
  claimedAt: string | null;
}

export interface MissionProgress {
  id: number;
  slug: string;
  title: string;
  description: string;
  metric: MissionMetric;
  progress: number;
  /**
   * Historical rows that are visible to the signed-in wallet but cannot count
   * until they are explicitly re-confirmed. Currently used for watchlists.
   */
  legacyProgress: number;
  threshold: number;
  isCompleted: boolean;
  completedAt: string | null;
  isActive: true;
  badge: MissionBadge;
}

export interface MissionCatalogItem {
  id: number;
  slug: string;
  title: string;
  description: string;
  metric: MissionMetric;
  threshold: number;
  isActive: boolean;
  badge: Pick<
    MissionBadge,
    "tokenId" | "name" | "description" | "imageUrl"
  >;
}

export interface MissionCatalog {
  missions: MissionCatalogItem[];
  claiming:
    | {
        configured: true;
        chainId: number;
        contractAddress: `0x${string}`;
      }
    | { configured: false };
}

export interface MissionSnapshot {
  address: `0x${string}`;
  missions: MissionProgress[];
}

export interface CompletedMissionForClaim {
  missionId: number;
  slug: string;
  completedAt: string;
  badge: Pick<
    MissionBadge,
    "tokenId" | "name" | "description" | "imageUrl"
  >;
}
