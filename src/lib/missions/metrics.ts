import type { MissionMetric } from "./types";

export type VerifiedTransactionMetricRow = {
  type: string | null;
  timestamp: string | null;
  tokenAddress?: string | null;
  creatorAddress?: string | null;
};

export type MissionMetricInput = {
  walletAddress: string;
  verifiedCreationDates: Array<string | null>;
  verifiedTransactions: VerifiedTransactionMetricRow[];
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
  const tradeDays = new Set<string>();
  const collectedCoins = new Set<string>();
  const buysByToken = new Map<string, number>();
  const sellsByToken = new Map<string, number>();
  const walletAddress = input.walletAddress.toLowerCase();
  let verifiedTradeCount = 0;

  for (const createdAt of input.verifiedCreationDates) {
    const day = utcDay(createdAt);
    if (day) activeDays.add(day);
  }
  for (const transaction of input.verifiedTransactions) {
    const isTrade = transaction.type === "buy" || transaction.type === "sell";
    const day = utcDay(transaction.timestamp);
    if (day) activeDays.add(day);
    if (isTrade) {
      verifiedTradeCount += 1;
      if (day) tradeDays.add(day);
    }

    const tokenAddress = transaction.tokenAddress?.toLowerCase();
    if (!tokenAddress) continue;
    const timestamp = transaction.timestamp
      ? new Date(transaction.timestamp).getTime()
      : Number.NaN;

    if (transaction.type === "buy") {
      const creatorAddress = transaction.creatorAddress?.toLowerCase();
      if (creatorAddress && creatorAddress !== walletAddress) {
        collectedCoins.add(tokenAddress);
      }
      if (Number.isFinite(timestamp)) {
        const previousBuy = buysByToken.get(tokenAddress);
        buysByToken.set(
          tokenAddress,
          previousBuy === undefined ? timestamp : Math.min(previousBuy, timestamp)
        );
      }
    }

    if (transaction.type === "sell" && Number.isFinite(timestamp)) {
      const previousSell = sellsByToken.get(tokenAddress);
      sellsByToken.set(
        tokenAddress,
        previousSell === undefined ? timestamp : Math.max(previousSell, timestamp)
      );
    }
  }

  const roundTripCount = Array.from(buysByToken).filter(
    ([tokenAddress, firstBuy]) =>
      (sellsByToken.get(tokenAddress) ?? Number.NEGATIVE_INFINITY) > firstBuy
  ).length;

  return {
    verified_creation: verifiedCreationCount,
    verified_buy: verifiedBuyCount,
    watchlist_token: 0,
    ecosystem_role:
      Number(verifiedCreationCount > 0) + Number(verifiedBuyCount > 0),
    verified_activity_day: activeDays.size,
    verified_trade: verifiedTradeCount,
    distinct_collected_coin: collectedCoins.size,
    round_trip_token: roundTripCount,
    verified_trade_day: tradeDays.size,
    completed_standard_mission: 0,
  };
}
