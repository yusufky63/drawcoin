export const MAX_MARKET_LIMIT = 100;
export const MAX_MARKET_PAGE = 1_000;
export const MAX_MARKET_SEARCH_LENGTH = 100;

const MARKET_QUERY_PARAMETERS = new Set([
  "activity",
  "creationType",
  "limit",
  "page",
  "search",
  "sort",
]);
const MARKET_SORT_VALUES = new Set([
  "market-cap",
  "most-holders",
  "most-traded",
  "most-watched",
  "newest",
  "oldest",
  "recently-traded",
  "volume-high",
]);
const MARKET_CREATION_TYPES = new Set(["", "ai", "hand-drawn"]);
const MARKET_ACTIVITY_VALUES = new Set(["", "traded"]);

export type MarketQuery = {
  activity: string;
  creationType: string;
  limit: number;
  page: number;
  search: string;
  sort: string;
};

export type MarketMeta = {
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type WatchlistCountRow = {
  token_address: unknown;
  watchlist_count: unknown;
};

export class MarketQueryError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "MarketQueryError";
  }
}

function singleValue(searchParams: URLSearchParams, key: string) {
  const values = searchParams.getAll(key);
  if (values.length > 1) {
    throw new MarketQueryError(`The ${key} parameter must be provided once.`);
  }
  return values[0];
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
  name: string
) {
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new MarketQueryError(`The ${name} parameter is invalid.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new MarketQueryError(`The ${name} parameter is out of range.`);
  }
  return parsed;
}

export function parseMarketQuery(searchParams: URLSearchParams): MarketQuery {
  for (const key of searchParams.keys()) {
    if (!MARKET_QUERY_PARAMETERS.has(key)) {
      throw new MarketQueryError("The market query contains an unknown parameter.");
    }
  }

  const page = positiveInteger(
    singleValue(searchParams, "page"),
    1,
    MAX_MARKET_PAGE,
    "page"
  );
  const limit = positiveInteger(
    singleValue(searchParams, "limit"),
    MAX_MARKET_LIMIT,
    MAX_MARKET_LIMIT,
    "limit"
  );
  const search = (singleValue(searchParams, "search") ?? "").trim();
  if (search.length > MAX_MARKET_SEARCH_LENGTH) {
    throw new MarketQueryError("The search parameter is too long.");
  }

  const sort = singleValue(searchParams, "sort") ?? "newest";
  if (!MARKET_SORT_VALUES.has(sort)) {
    throw new MarketQueryError("The sort parameter is invalid.");
  }

  const creationType = singleValue(searchParams, "creationType") ?? "";
  if (!MARKET_CREATION_TYPES.has(creationType)) {
    throw new MarketQueryError("The creationType parameter is invalid.");
  }

  const activity = singleValue(searchParams, "activity") ?? "";
  if (!MARKET_ACTIVITY_VALUES.has(activity)) {
    throw new MarketQueryError("The activity parameter is invalid.");
  }

  return { activity, creationType, limit, page, search, sort };
}

export function buildMarketMeta(
  total: number,
  limit: number,
  page: number
): MarketMeta {
  const safeTotal = Number.isSafeInteger(total) && total > 0 ? total : 0;
  return {
    limit,
    page,
    total: safeTotal,
    totalPages: Math.ceil(safeTotal / limit),
  };
}

/**
 * Normalizes the service-role aggregate RPC response back to the exact set of
 * requested addresses. Returning an explicit zero prevents a missing row from
 * being mistaken for an unknown/loading state in the client.
 */
export function normalizeWatchlistCounts(
  requestedAddresses: readonly string[],
  rows: readonly WatchlistCountRow[] | null | undefined
): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(
    requestedAddresses.map((address) => [address.toLowerCase(), 0])
  );

  for (const row of rows ?? []) {
    if (typeof row.token_address !== "string") continue;
    const address = row.token_address.toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(counts, address)) continue;

    const count = Number(row.watchlist_count);
    counts[address] = Number.isFinite(count)
      ? Math.max(0, Math.floor(count))
      : 0;
  }

  return counts;
}

function quotePostgrestLikePattern(value: string) {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[%_*]/g, (character) => `\\${character}`);
  return `"%${escaped}%"`;
}

export function buildPostgrestCoinSearchFilter(
  search: string,
  includeContractAddress = false
) {
  const pattern = quotePostgrestLikePattern(search);
  const columns = [
    "name",
    "symbol",
    "description",
    "creator_name",
    "creator_address",
  ];
  if (includeContractAddress) columns.push("contract_address");
  return columns
    .map((column) => `${column}.ilike.${pattern}`)
    .join(",");
}

function abortError(signal?: AbortSignal) {
  if (signal?.reason instanceof Error) return signal.reason;
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

export async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  task: (value: T, index: number, signal?: AbortSignal) => Promise<R>,
  signal?: AbortSignal
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError("Concurrency must be a positive integer.");
  }
  if (values.length === 0) return [];

  const results = new Array<R>(values.length);
  let cursor = 0;

  const worker = async () => {
    while (true) {
      if (signal?.aborted) throw abortError(signal);
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      results[index] = await task(values[index], index, signal);
    }
  };

  const workerCount = Math.min(concurrency, values.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
