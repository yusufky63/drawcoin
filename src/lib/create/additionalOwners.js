import { getAddress, isAddress } from "viem";

/**
 * Validate and canonicalize the optional owner set before it reaches Zora.
 * Duplicate owners are collapsed, while the creator is rejected because the
 * protocol already adds that address as an owner.
 *
 * @param {unknown} owners
 * @param {string} creator
 * @returns {`0x${string}`[]}
 */
export function normalizeAdditionalOwners(owners, creator) {
  if (!Array.isArray(owners)) {
    throw new Error("Additional owners must be an array");
  }
  if (!isAddress(creator)) {
    throw new Error("Creator address is invalid");
  }

  const normalizedCreator = getAddress(creator);
  const creatorKey = normalizedCreator.toLowerCase();
  const seen = new Set();
  const normalizedOwners = [];

  for (const owner of owners) {
    if (typeof owner !== "string" || !isAddress(owner)) {
      throw new Error("An additional owner address is invalid");
    }

    const normalizedOwner = getAddress(owner);
    const key = normalizedOwner.toLowerCase();
    if (key === creatorKey) {
      throw new Error("The creator is already an owner");
    }
    if (seen.has(key)) continue;

    seen.add(key);
    normalizedOwners.push(normalizedOwner);
  }

  return normalizedOwners;
}
