type CryptoPriceSymbol = "ETH" | "ZORA";

interface CryptoPricePayload {
  success?: unknown;
  price?: unknown;
  observedAt?: unknown;
  error?: unknown;
  retryable?: unknown;
}

const MAX_QUOTE_AGE_MS = 2 * 60_000;
const MAX_CLOCK_SKEW_MS = 60_000;

export class CryptoPriceRequestError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.name = "CryptoPriceRequestError";
    this.status = status;
    this.retryable = retryable;
  }
}

function readPayload(value: unknown): CryptoPricePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as CryptoPricePayload;
}

/** Fetch a recently observed live price. Rejects instead of inventing a value. */
export async function getCryptoPrice(
  symbol: CryptoPriceSymbol = "ETH"
): Promise<number> {
  const response = await fetch(`/api/crypto-price?symbol=${symbol}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  const payload = readPayload(await response.json().catch(() => null));

  if (!response.ok) {
    throw new CryptoPriceRequestError(
      typeof payload.error === "string"
        ? payload.error
        : `Live ${symbol} price is unavailable.`,
      response.status,
      payload.retryable === true || response.status >= 500
    );
  }

  const price = Number(payload.price);
  const observedAtMs =
    typeof payload.observedAt === "string"
      ? Date.parse(payload.observedAt)
      : Number.NaN;
  const quoteAgeMs = Date.now() - observedAtMs;

  if (
    payload.success !== true ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isFinite(observedAtMs) ||
    quoteAgeMs > MAX_QUOTE_AGE_MS ||
    quoteAgeMs < -MAX_CLOCK_SKEW_MS
  ) {
    throw new CryptoPriceRequestError(
      `The ${symbol} price response was invalid or stale.`,
      502,
      true
    );
  }

  return price;
}

/** @deprecated Use getCryptoPrice("ETH") instead. */
export const getETHPrice = () => getCryptoPrice("ETH");

/** @deprecated Use getCryptoPrice("ZORA") instead. */
export const getZORAPrice = () => getCryptoPrice("ZORA");
