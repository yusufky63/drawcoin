export type TickerActivityType = "buy" | "sell" | "create";

export interface TickerCoinSnapshotRow {
  contract_address?: string | null;
  name?: string | null;
  symbol?: string | null;
  image_url?: string | null;
  current_price?: unknown;
  total_supply?: unknown;
  holders?: unknown;
  last_synced_at?: string | null;
}

export interface TickerTransactionRow {
  token_address?: string | null;
  timestamp?: string | null;
  type?: string | null;
  verified_at?: string | null;
  token_details?:
    | TickerCoinSnapshotRow
    | TickerCoinSnapshotRow[]
    | null;
}

export interface TickerTokenDto {
  address: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  marketCapUsd: number | null;
  holders: number | null;
  metricsUpdatedAt: string | null;
  lastActivity: {
    type: TickerActivityType;
    timestamp: string;
  } | null;
}

export interface TickerResponseDto {
  data: TickerTokenDto[];
  source: "supabase";
  generatedAt: string;
}

const CONTRACT_ADDRESS_PATTERN = /^0x[a-f0-9]{40}$/;

function finiteNonNegativeNumber(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeActivityType(
  value: string | null | undefined
): TickerActivityType | null {
  return value === "buy" || value === "sell" || value === "create"
    ? value
    : null;
}

/**
 * Supabase stores the token price in USD and the human-readable token supply.
 * A market-cap snapshot is only exposed when both persisted inputs are
 * positive. Creation-time zero placeholders therefore stay "unavailable"
 * instead of being presented as measured market data.
 */
export function derivePersistedMarketCapUsd(
  currentPrice: unknown,
  totalSupply: unknown
) {
  const price = finiteNonNegativeNumber(currentPrice);
  const supply = finiteNonNegativeNumber(totalSupply);
  if (price === null || supply === null || price === 0 || supply === 0) {
    return null;
  }

  const marketCap = price * supply;
  return Number.isFinite(marketCap) && marketCap >= 0 ? marketCap : null;
}

function normalizeHolderCount(value: unknown) {
  const parsed = finiteNonNegativeNumber(value);
  return parsed === null ? null : Math.floor(parsed);
}

function singleTokenDetails(value: TickerTransactionRow["token_details"]) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toTickerToken(
  details: TickerCoinSnapshotRow,
  fallbackAddress: string | null | undefined,
  lastActivity: TickerTokenDto["lastActivity"]
): TickerTokenDto | null {
  const address = (details.contract_address ?? fallbackAddress ?? "")
    .trim()
    .toLowerCase();
  const name = details.name?.trim() ?? "";
  const symbol = details.symbol?.trim() ?? "";

  // Identity comes exclusively from a complete Supabase coin row. Do not
  // invent a generic symbol or name when persisted data is incomplete.
  if (!CONTRACT_ADDRESS_PATTERN.test(address) || !name || !symbol) return null;

  return {
    address,
    name,
    symbol,
    imageUrl: details.image_url?.trim() || null,
    marketCapUsd: derivePersistedMarketCapUsd(
      details.current_price,
      details.total_supply
    ),
    holders: normalizeHolderCount(details.holders),
    metricsUpdatedAt: normalizeTimestamp(details.last_synced_at),
    lastActivity,
  };
}

function verifiedActivity(
  row: TickerTransactionRow
): TickerTokenDto["lastActivity"] {
  // Legacy transactions are useful as deterministic recency signals, but they
  // must not be presented to users as a verified buy/sell/create event.
  if (!normalizeTimestamp(row.verified_at)) return null;
  const type = normalizeActivityType(row.type);
  const timestamp = normalizeTimestamp(row.timestamp);
  return type && timestamp ? { type, timestamp } : null;
}

export function buildTickerTokens(
  transactionRows: TickerTransactionRow[],
  catalogRows: TickerCoinSnapshotRow[],
  limit: number
) {
  const tokens = new Map<string, TickerTokenDto>();

  for (const row of transactionRows) {
    const details = singleTokenDetails(row.token_details);
    if (!details) continue;
    const token = toTickerToken(
      details,
      row.token_address,
      verifiedActivity(row)
    );
    if (token && !tokens.has(token.address)) tokens.set(token.address, token);
    if (tokens.size === limit) return Array.from(tokens.values());
  }

  // A quiet or partially migrated activity table falls back to the newest
  // catalog rows. The route supplies created_at + id tie-breakers, so this fill
  // order remains deterministic across requests.
  for (const details of catalogRows) {
    const token = toTickerToken(details, null, null);
    if (token && !tokens.has(token.address)) tokens.set(token.address, token);
    if (tokens.size === limit) break;
  }

  return Array.from(tokens.values());
}
