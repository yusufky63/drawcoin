export type SupportedPriceSymbol = "ETH" | "ZORA";

export interface FreshCryptoPrice {
  symbol: SupportedPriceSymbol;
  price: number;
  source: string;
  observedAt: string;
  sourceUpdatedAt?: string;
}

interface PriceSource {
  name: string;
  fetchQuote: () => Promise<Omit<FreshCryptoPrice, "symbol" | "source">>;
}

const REQUEST_TIMEOUT_MS = 4_000;
const QUOTE_CACHE_TTL_MS = 20_000;
const MAX_PRICE_USD = 100_000_000;
const MAX_CLOCK_SKEW_MS = 60_000;
const MAX_SOURCE_AGE_MS = 10 * 60_000;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Price provider returned an invalid payload.");
  }

  return value as Record<string, unknown>;
}

export function parsePositiveUsdPrice(value: unknown): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim() === "")
  ) {
    throw new Error("Price provider returned an invalid USD price.");
  }

  const price = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE_USD) {
    throw new Error("Price provider returned an invalid USD price.");
  }

  return price;
}

export function normalizeSourceTimestamp(
  value: unknown,
  observedAtMs: number
): string | undefined {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return undefined;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;

  const timestampMs = numeric < 1_000_000_000_000 ? numeric * 1_000 : numeric;
  const ageMs = observedAtMs - timestampMs;

  if (ageMs < -MAX_CLOCK_SKEW_MS || ageMs > MAX_SOURCE_AGE_MS) {
    return undefined;
  }

  return new Date(timestampMs).toISOString();
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Price provider responded with HTTP ${response.status}.`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBinanceEth(): Promise<
  Omit<FreshCryptoPrice, "symbol" | "source">
> {
  const payload = asRecord(
    await fetchJson(
      "https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT"
    )
  );
  const observedAtMs = Date.now();

  return {
    price: parsePositiveUsdPrice(payload.lastPrice),
    observedAt: new Date(observedAtMs).toISOString(),
    sourceUpdatedAt: normalizeSourceTimestamp(payload.closeTime, observedAtMs),
  };
}

async function fetchCoinGecko(
  coinId: string
): Promise<Omit<FreshCryptoPrice, "symbol" | "source">> {
  const payload = asRecord(
    await fetchJson(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_last_updated_at=true`
    )
  );
  const coin = asRecord(payload[coinId]);
  const observedAtMs = Date.now();

  return {
    price: parsePositiveUsdPrice(coin.usd),
    observedAt: new Date(observedAtMs).toISOString(),
    sourceUpdatedAt: normalizeSourceTimestamp(
      coin.last_updated_at,
      observedAtMs
    ),
  };
}

async function fetchCoinbaseEth(): Promise<
  Omit<FreshCryptoPrice, "symbol" | "source">
> {
  const payload = asRecord(
    await fetchJson("https://api.coinbase.com/v2/prices/ETH-USD/spot")
  );
  const data = asRecord(payload.data);

  return {
    price: parsePositiveUsdPrice(data.amount),
    observedAt: new Date().toISOString(),
  };
}

async function fetchKrakenEth(): Promise<
  Omit<FreshCryptoPrice, "symbol" | "source">
> {
  const payload = asRecord(
    await fetchJson("https://api.kraken.com/0/public/Ticker?pair=ETHUSD")
  );
  const result = asRecord(payload.result);
  const ticker = asRecord(Object.values(result)[0]);

  if (!Array.isArray(ticker.c)) {
    throw new Error("Kraken returned an invalid ticker payload.");
  }

  return {
    price: parsePositiveUsdPrice(ticker.c[0]),
    observedAt: new Date().toISOString(),
  };
}

const ETH_SOURCES: PriceSource[] = [
  { name: "Binance", fetchQuote: fetchBinanceEth },
  { name: "CoinGecko", fetchQuote: () => fetchCoinGecko("ethereum") },
  { name: "Coinbase", fetchQuote: fetchCoinbaseEth },
  { name: "Kraken", fetchQuote: fetchKrakenEth },
];

const ZORA_SOURCES: PriceSource[] = [
  { name: "CoinGecko", fetchQuote: () => fetchCoinGecko("zora") },
];

const quoteCache = new Map<
  SupportedPriceSymbol,
  { quote: FreshCryptoPrice; expiresAt: number }
>();
const inFlightQuotes = new Map<
  SupportedPriceSymbol,
  Promise<FreshCryptoPrice>
>();

export class CryptoPriceUnavailableError extends Error {
  constructor(symbol: SupportedPriceSymbol) {
    super(`No live ${symbol} price source is currently available.`);
    this.name = "CryptoPriceUnavailableError";
  }
}

async function fetchFreshCryptoPrice(
  symbol: SupportedPriceSymbol
): Promise<FreshCryptoPrice> {
  const sources = symbol === "ETH" ? ETH_SOURCES : ZORA_SOURCES;

  try {
    return await Promise.any(
      sources.map(async (source) => {
        try {
          const quote = await source.fetchQuote();
          return { ...quote, symbol, source: source.name };
        } catch (error) {
          console.warn(
            `[CryptoPrice] ${source.name} failed for ${symbol}.`,
            error
          );
          throw error;
        }
      })
    );
  } catch {
    throw new CryptoPriceUnavailableError(symbol);
  }
}

export async function getFreshCryptoPrice(
  symbol: SupportedPriceSymbol
): Promise<FreshCryptoPrice> {
  const cached = quoteCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.quote;

  const existingRequest = inFlightQuotes.get(symbol);
  if (existingRequest) return existingRequest;

  const request = fetchFreshCryptoPrice(symbol).then((quote) => {
    quoteCache.set(symbol, {
      quote,
      expiresAt: Date.now() + QUOTE_CACHE_TTL_MS,
    });
    return quote;
  });

  inFlightQuotes.set(symbol, request);

  try {
    return await request;
  } finally {
    if (inFlightQuotes.get(symbol) === request) {
      inFlightQuotes.delete(symbol);
    }
  }
}
