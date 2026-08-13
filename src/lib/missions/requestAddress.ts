import { getAddress, isAddress, type Address } from "viem";

export function parseMissionRequestAddress(value: unknown): Address | null {
  if (typeof value !== "string") return null;

  const address = value.trim();
  return isAddress(address, { strict: false }) ? getAddress(address) : null;
}
