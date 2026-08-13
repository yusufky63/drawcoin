import type { CustomCanvasDraft } from "@/components/ui/CustomCanvas";
import type { CoinCreationRecordPayload } from "@/lib/functions/createToken";
import { getAddress, isAddress } from "viem";

const CREATE_DRAFT_STORAGE_KEY = "drawcoin:create-draft:v1";
const PENDING_CREATION_STORAGE_KEY = "drawcoin:pending-creation:v1";
const DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1_000;
const PENDING_CREATION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

export interface CreateDraftV1 {
  version: 1;
  updatedAt: number;
  currentStep: 1 | 2 | 3;
  canvas: CustomCanvasDraft | null;
  details: {
    name: string;
    symbol: string;
    description: string;
  };
  options: {
    ownersAddresses: string[];
  };
}

export interface PendingCreationV1 {
  version: 1;
  updatedAt: number;
  transactionHash: string;
  tokenAddress: string | null;
  payload: CoinCreationRecordPayload;
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStep(value: unknown): value is 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3;
}

function isCanvasDraft(value: unknown): value is CustomCanvasDraft {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.elements)) {
    return false;
  }

  const canvas = value.canvas;
  return (
    isRecord(canvas) &&
    canvas.width === 1024 &&
    canvas.height === 1024 &&
    typeof canvas.background === "string"
  );
}

function parseCreateDraft(value: unknown): CreateDraftV1 | null {
  if (!isRecord(value) || value.version !== 1 || !isStep(value.currentStep)) {
    return null;
  }

  const details = value.details;
  const options = value.options;
  const updatedAt = value.updatedAt;

  if (
    typeof updatedAt !== "number" ||
    !Number.isFinite(updatedAt) ||
    Date.now() - updatedAt > DRAFT_MAX_AGE_MS ||
    !isRecord(details) ||
    typeof details.name !== "string" ||
    typeof details.symbol !== "string" ||
    typeof details.description !== "string" ||
    !isRecord(options) ||
    !Array.isArray(options.ownersAddresses) ||
    !options.ownersAddresses.every((item) => typeof item === "string") ||
    (value.canvas !== null && !isCanvasDraft(value.canvas))
  ) {
    return null;
  }

  return {
    version: 1,
    updatedAt,
    currentStep: value.currentStep,
    canvas: value.canvas,
    details: {
      name: details.name.slice(0, 50),
      symbol: details.symbol.slice(0, 10),
      description: details.description.slice(0, 500),
    },
    options: {
      ownersAddresses: options.ownersAddresses.slice(0, 20),
    },
  };
}

function isRecordPayload(value: unknown): value is CoinCreationRecordPayload {
  if (!isRecord(value)) return false;

  return (
    typeof value.name === "string" &&
    typeof value.symbol === "string" &&
    typeof value.description === "string" &&
    typeof value.image_url === "string" &&
    typeof value.creator_address === "string" &&
    isAddress(value.creator_address) &&
    typeof value.tx_hash === "string" &&
    /^0x[0-9a-fA-F]{64}$/.test(value.tx_hash) &&
    value.chain_id === 8453 &&
    (value.currency === "ETH" ||
      value.currency === "ZORA" ||
      value.currency === "CREATOR_COIN" ||
      value.currency === "CREATOR_COIN_OR_ZORA") &&
    typeof value.platform_referrer === "string" &&
    isAddress(value.platform_referrer) &&
    (value.contract_address === undefined ||
      (typeof value.contract_address === "string" &&
        isAddress(value.contract_address)))
  );
}

function addressesMatch(first: string, second: string): boolean {
  return getAddress(first) === getAddress(second);
}

function parsePendingCreation(value: unknown): PendingCreationV1 | null {
  if (!isRecord(value) || value.version !== 1) return null;

  const updatedAt = value.updatedAt;
  const transactionHash = value.transactionHash;
  const tokenAddress = value.tokenAddress;
  const payload = value.payload;
  if (
    typeof updatedAt !== "number" ||
    !Number.isFinite(updatedAt) ||
    Date.now() - updatedAt > PENDING_CREATION_MAX_AGE_MS ||
    typeof transactionHash !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(transactionHash) ||
    (tokenAddress !== null &&
      (typeof tokenAddress !== "string" || !isAddress(tokenAddress))) ||
    !isRecordPayload(payload) ||
    transactionHash.toLowerCase() !== payload.tx_hash.toLowerCase() ||
    (tokenAddress !== null &&
      payload.contract_address !== undefined &&
      !addressesMatch(tokenAddress, payload.contract_address))
  ) {
    return null;
  }

  return {
    version: 1,
    updatedAt,
    transactionHash,
    tokenAddress,
    payload,
  };
}

function loadStoredValue<T>(
  key: string,
  parser: (value: unknown) => T | null
): T | null {
  const storage = getBrowserStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;

    const parsed = parser(JSON.parse(raw));
    if (!parsed) storage.removeItem(key);
    return parsed;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Storage may be disabled between reads.
    }
    return null;
  }
}

function saveStoredValue(key: string, value: unknown): boolean {
  const storage = getBrowserStorage();
  if (!storage) return false;

  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadCreateDraft(): CreateDraftV1 | null {
  return loadStoredValue(CREATE_DRAFT_STORAGE_KEY, parseCreateDraft);
}

export function saveCreateDraft(draft: CreateDraftV1): boolean {
  return saveStoredValue(CREATE_DRAFT_STORAGE_KEY, draft);
}

export function clearCreateDraft(): void {
  try {
    getBrowserStorage()?.removeItem(CREATE_DRAFT_STORAGE_KEY);
  } catch {
    // Clearing a draft is best effort when storage is unavailable.
  }
}

export function loadPendingCreation(): PendingCreationV1 | null {
  return loadStoredValue(PENDING_CREATION_STORAGE_KEY, parsePendingCreation);
}

export function savePendingCreation(pending: PendingCreationV1): boolean {
  return saveStoredValue(PENDING_CREATION_STORAGE_KEY, pending);
}

export function clearPendingCreation(): void {
  try {
    getBrowserStorage()?.removeItem(PENDING_CREATION_STORAGE_KEY);
  } catch {
    // Clearing recovery state is best effort when storage is unavailable.
  }
}

export const createDraftStorageInternals = {
  parseCreateDraft,
  parsePendingCreation,
};
