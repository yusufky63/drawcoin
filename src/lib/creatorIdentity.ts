import { getAddress } from "viem";

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export const MAX_CREATOR_IDENTITY_BATCH = 100;
export const MAX_CREATOR_BASENAME_RPC_BATCH = 50;

export type CreatorIdentityInput = {
  address?: string | null;
  persistedName?: string | null;
  resolvedBasename?: string | null;
};

export function normalizeCreatorAddress(value?: string | null) {
  const candidate = value?.trim();
  if (!candidate || !EVM_ADDRESS_PATTERN.test(candidate)) return null;
  return candidate.toLowerCase();
}

export function normalizeBasename(value?: string | null) {
  const candidate = value?.trim().toLowerCase();
  if (
    !candidate ||
    candidate.length > 255 ||
    !candidate.endsWith(".base.eth") ||
    /[\u0000-\u0020\u007f]/.test(candidate)
  ) {
    return null;
  }
  return candidate;
}

export function formatCreatorAddress(value?: string | null) {
  const normalized = normalizeCreatorAddress(value);
  if (!normalized) return null;

  const checksummed = getAddress(normalized);
  return `${checksummed.slice(0, 6)}…${checksummed.slice(-4)}`;
}

export function createCreatorAddressBatch(
  values: Iterable<string | null | undefined>,
  maximumItems = MAX_CREATOR_IDENTITY_BATCH
) {
  if (!Number.isSafeInteger(maximumItems) || maximumItems < 1) return [];

  const addresses = new Set<string>();
  for (const value of values) {
    const address = normalizeCreatorAddress(value);
    if (address) addresses.add(address);
    if (addresses.size >= maximumItems) break;
  }
  return Array.from(addresses);
}

/**
 * Creator labels intentionally accept only verified Basename-shaped names.
 * A legacy creator_name containing a full wallet address must never leak back
 * into compact cards; the deterministic checksum label is the safe fallback.
 */
export function getCreatorDisplayLabel({
  address,
  persistedName,
  resolvedBasename,
}: CreatorIdentityInput) {
  return (
    normalizeBasename(resolvedBasename) ??
    normalizeBasename(persistedName) ??
    formatCreatorAddress(address)
  );
}
