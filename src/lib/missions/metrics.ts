import type { MissionMetric } from "./types";

export type VerifiedTransactionMetricRow = {
  type: string | null;
  timestamp: string | null;
};

export type MissionMetricInput = {
  verifiedCreationDates: Array<string | null>;
  verifiedTransactions: VerifiedTransactionMetricRow[];
  verifiedWatchlistCount: number;
};

function utcDay(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Builds mission counters only from rows already marked verified by the
 * server. Keeping the composition pure makes the multi-role and multi-day
 * rules deterministic and independently testable.
 */
export function calculateMissionMetricValues(
  input: MissionMetricInput
): Record<MissionMetric, number> {
  const verifiedBuyCount = input.verifiedTransactions.filter(
    (transaction) => transaction.type === "buy"
  ).length;
  const verifiedCreationCount = input.verifiedCreationDates.length;
  const activeDays = new Set<string>();

  for (const createdAt of input.verifiedCreationDates) {
    const day = utcDay(createdAt);
    if (day) activeDays.add(day);
  }
  for (const transaction of input.verifiedTransactions) {
    const day = utcDay(transaction.timestamp);
    if (day) activeDays.add(day);
  }

  return {
    verified_creation: verifiedCreationCount,
    verified_buy: verifiedBuyCount,
    watchlist_token: Math.max(0, input.verifiedWatchlistCount),
    ecosystem_role:
      Number(verifiedCreationCount > 0) + Number(verifiedBuyCount > 0),
    verified_activity_day: activeDays.size,
  };
}
