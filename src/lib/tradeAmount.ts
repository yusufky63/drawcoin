import { formatUnits, parseEther, parseUnits } from "viem";

export const BASE_USDC_ADDRESS =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const BASE_USDC_DECIMALS = 6;
export const ETH_GAS_RESERVE_WEI = parseEther("0.0005");
export const TOKEN_SELL_MAX_BASIS_POINTS = BigInt(9_800);

const BASIS_POINTS = BigInt(10_000);

const DECIMAL_INPUT_PATTERN = /^(?:\d+\.?\d*|\.\d+)$/;

export function parseTradeAmount(
  value: string,
  decimals: number
): bigint | null {
  const normalized = value.trim();
  if (!DECIMAL_INPUT_PATTERN.test(normalized)) return null;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    return null;
  }

  try {
    const amount = parseUnits(normalized, decimals);
    return amount > BigInt(0) ? amount : null;
  } catch {
    return null;
  }
}

export function spendableTradeBalance(
  balance: bigint,
  reserve: bigint = BigInt(0)
): bigint {
  if (balance <= BigInt(0)) return BigInt(0);
  if (reserve <= BigInt(0)) return balance;
  return balance > reserve ? balance - reserve : BigInt(0);
}

/**
 * Zora exact-input quotes can reject a wallet's entire token balance when the
 * pool cannot consume the final edge of the route. Keep Max deterministic and
 * raw-integer safe while still allowing users to type a larger custom amount.
 */
export function tokenSellQuoteReserve(balance: bigint): bigint {
  if (balance <= BigInt(0)) return BigInt(0);
  const maximumQuotedAmount =
    (balance * TOKEN_SELL_MAX_BASIS_POINTS) / BASIS_POINTS;
  return balance - maximumQuotedAmount;
}

export function amountForPercentage(
  balance: bigint,
  decimals: number,
  percentage: number,
  reserve: bigint = BigInt(0)
): string {
  const wholePercentage = Math.max(0, Math.min(100, Math.round(percentage)));
  const spendable = spendableTradeBalance(balance, reserve);
  const amount =
    (spendable * BigInt(wholePercentage)) / BigInt(100);
  return amount > BigInt(0) ? formatUnits(amount, decimals) : "";
}

export function percentageForAmount(
  amount: string,
  decimals: number,
  balance: bigint,
  reserve: bigint = BigInt(0)
): number {
  const parsed = parseTradeAmount(amount, decimals);
  const spendable = spendableTradeBalance(balance, reserve);
  if (parsed === null || spendable === BigInt(0)) return 0;
  const basisPoints = (parsed * BigInt(10_000)) / spendable;
  return Math.min(100, Number(basisPoints) / 100);
}

export function formatTradeBalance(
  balance: bigint,
  decimals: number,
  maximumFractionDigits = 8
): string {
  const [whole, fraction = ""] = formatUnits(balance, decimals).split(".");
  const visibleFraction = fraction
    .slice(0, Math.max(0, maximumFractionDigits))
    .replace(/0+$/, "");
  return visibleFraction ? `${whole}.${visibleFraction}` : whole;
}
