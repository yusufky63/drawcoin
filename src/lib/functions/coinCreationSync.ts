import type { Coin } from "../supabase";

export const BASE_CHAIN_ID = 8453 as const;

export type CoinCreationCurrency =
  | "ETH"
  | "ZORA"
  | "CREATOR_COIN"
  | "CREATOR_COIN_OR_ZORA";

/**
 * Everything needed to replay DrawCoin's verified record step after the
 * onchain transaction has already succeeded. It contains no credentials or
 * signatures; the server still requires the wallet's HTTP-only SIWE session
 * and re-verifies the Base receipt on every call.
 */
export interface CoinCreationRecordPayload {
  name: string;
  symbol: string;
  description: string;
  image_url: string;
  creator_address: string;
  tx_hash: string;
  chain_id: typeof BASE_CHAIN_ID;
  currency: CoinCreationCurrency;
  platform_referrer: string;
  contract_address?: string;
}

export type CoinRecordStatus = "recorded" | "sync_required";

export type CoinRecordErrorCode =
  | "WALLET_SESSION_REQUIRED"
  | "WALLET_SESSION_UNAVAILABLE"
  | "INVALID_RECORD_PAYLOAD"
  | "CREATOR_MISMATCH"
  | "PLATFORM_REFERRER_MISMATCH"
  | "TRANSACTION_NOT_CONFIRMED"
  | "ONCHAIN_CREATION_MISMATCH"
  | "RECORD_CONFLICT"
  | "VERIFICATION_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "UNEXPECTED_RESPONSE";

export interface CoinRecordError {
  code: CoinRecordErrorCode;
  message: string;
  retryable: boolean;
}

export interface CoinRecordResult {
  status: CoinRecordStatus;
  recoveryPayload: CoinCreationRecordPayload;
  coin?: Coin;
  error?: CoinRecordError;
}

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

const ERROR_DETAILS: Record<
  CoinRecordErrorCode,
  Pick<CoinRecordError, "message" | "retryable">
> = {
  WALLET_SESSION_REQUIRED: {
    message: "Verify your wallet, then sync this token again.",
    retryable: true,
  },
  WALLET_SESSION_UNAVAILABLE: {
    message: "Wallet verification is temporarily unavailable.",
    retryable: true,
  },
  INVALID_RECORD_PAYLOAD: {
    message: "The saved token details are incomplete or invalid.",
    retryable: false,
  },
  CREATOR_MISMATCH: {
    message: "The verified wallet does not match this token's creator.",
    retryable: false,
  },
  PLATFORM_REFERRER_MISMATCH: {
    message: "This creation is not attributed to DrawCoin.",
    retryable: false,
  },
  TRANSACTION_NOT_CONFIRMED: {
    message: "The Base transaction is not confirmed as successful.",
    retryable: true,
  },
  ONCHAIN_CREATION_MISMATCH: {
    message: "The saved details do not match the verified Base creation.",
    retryable: false,
  },
  RECORD_CONFLICT: {
    message:
      "This transaction or token is already linked to a different verified activity.",
    retryable: false,
  },
  VERIFICATION_UNAVAILABLE: {
    message:
      "The token was created on Base, but DrawCoin could not sync it yet.",
    retryable: true,
  },
  NETWORK_ERROR: {
    message:
      "The token was created on Base, but the sync request could not connect.",
    retryable: true,
  },
  UNEXPECTED_RESPONSE: {
    message:
      "The token was created on Base, but DrawCoin returned an unexpected sync response.",
    retryable: true,
  },
};

const KNOWN_ERROR_CODES = new Set<CoinRecordErrorCode>(
  Object.keys(ERROR_DETAILS) as CoinRecordErrorCode[]
);

function createRecordError(code: CoinRecordErrorCode): CoinRecordError {
  return { code, ...ERROR_DETAILS[code] };
}

function fallbackCodeForStatus(status: number): CoinRecordErrorCode {
  if (status === 401) return "WALLET_SESSION_REQUIRED";
  if (status === 403) return "CREATOR_MISMATCH";
  if (status === 409) return "RECORD_CONFLICT";
  if (status === 400 || status === 413 || status === 415) {
    return "INVALID_RECORD_PAYLOAD";
  }
  if (status === 422) return "ONCHAIN_CREATION_MISMATCH";
  if (status === 503) return "VERIFICATION_UNAVAILABLE";
  return "UNEXPECTED_RESPONSE";
}

async function readResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getResponseCode(body: unknown, status: number): CoinRecordErrorCode {
  if (
    body &&
    typeof body === "object" &&
    "code" in body &&
    typeof body.code === "string" &&
    KNOWN_ERROR_CODES.has(body.code as CoinRecordErrorCode)
  ) {
    return body.code as CoinRecordErrorCode;
  }

  return fallbackCodeForStatus(status);
}

/**
 * Performs exactly one idempotent sync request. It never retries a wallet or
 * network operation automatically; the caller decides when the user wants to
 * try again.
 */
export async function syncCreatedToken(
  payload: CoinCreationRecordPayload,
  options: { fetcher?: Fetcher; signal?: AbortSignal } = {}
): Promise<CoinRecordResult> {
  const fetcher = options.fetcher ?? fetch;
  let response: Response;

  try {
    response = await fetcher("/api/coins/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      credentials: "same-origin",
      signal: options.signal,
    });
  } catch {
    return {
      status: "sync_required",
      recoveryPayload: payload,
      error: createRecordError("NETWORK_ERROR"),
    };
  }

  const body = await readResponseJson(response);
  if (
    response.ok &&
    body &&
    typeof body === "object" &&
    "success" in body &&
    body.success === true &&
    "data" in body
  ) {
    return {
      status: "recorded",
      recoveryPayload: payload,
      coin: body.data as Coin,
    };
  }

  return {
    status: "sync_required",
    recoveryPayload: payload,
    error: createRecordError(getResponseCode(body, response.status)),
  };
}
