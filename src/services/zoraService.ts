import { getCoinsBatchSDK } from "./sdk/getCoins.js";

const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1_000;

type ZoraRetryOptions = {
  disableIndividualFallback?: boolean;
  initialBackoffMs?: number;
  maxRetries?: number;
  signal?: AbortSignal;
};

type ZoraRetryError = {
  code?: number | string;
  message?: string;
  name?: string;
  response?: { status?: number };
};

function retryErrorShape(error: unknown): ZoraRetryError {
  return error && typeof error === "object" ? (error as ZoraRetryError) : {};
}

function abortError(signal: AbortSignal) {
  if (signal.reason instanceof Error) return signal.reason;
  const error = new Error("The Zora request was aborted.");
  error.name = "AbortError";
  return error;
}

function raceWithSignal<T>(promise: Promise<T>, signal?: AbortSignal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError(signal));

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
}

function waitForRetry(delay: number, signal?: AbortSignal) {
  if (!signal) {
    return new Promise<void>((resolve) => setTimeout(resolve, delay));
  }
  if (signal.aborted) return Promise.reject(abortError(signal));

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delay);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(abortError(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function getCoinsBatchWithRetry(
  addresses: string[],
  chainId = 8453,
  options: ZoraRetryOptions = {}
) {
  const retries = Math.max(
    1,
    Math.min(MAX_RETRIES, options.maxRetries ?? MAX_RETRIES)
  );
  const initialBackoff = Math.max(
    0,
    Math.min(10_000, options.initialBackoffMs ?? INITIAL_BACKOFF)
  );

  for (let attempt = 0; attempt < retries; attempt += 1) {
    if (options.signal?.aborted) throw abortError(options.signal);

    try {
      return await raceWithSignal(
        getCoinsBatchSDK(addresses, chainId, {
          fallbackToIndividual: !options.disableIndividualFallback,
          signal: options.signal,
        }),
        options.signal
      );
    } catch (error: unknown) {
      const retryError = retryErrorShape(error);
      if (options.signal?.aborted || retryError.name === "AbortError") throw error;
      if (attempt === retries - 1) throw error;

      const message = String(retryError.message ?? "").toLowerCase();
      const isRateLimit =
        retryError.response?.status === 429 ||
        message.includes("rate limit") ||
        message.includes("429") ||
        retryError.code === 429;
      const isNetworkError =
        message.includes("network") ||
        message.includes("fetch") ||
        retryError.code === "ECONNRESET" ||
        retryError.code === "ECONNREFUSED" ||
        retryError.code === "ETIMEDOUT";
      const status =
        retryError.response?.status ??
        (typeof retryError.code === "number" ? retryError.code : undefined);
      const isServerError =
        typeof status === "number" && status >= 500 && status < 600;

      if (!isRateLimit && !isNetworkError && !isServerError) throw error;
      const delay = isRateLimit
        ? initialBackoff * Math.pow(2, attempt)
        : initialBackoff;
      await waitForRetry(delay, options.signal);
    }
  }

  throw new Error("Zora retries were exhausted.");
}
