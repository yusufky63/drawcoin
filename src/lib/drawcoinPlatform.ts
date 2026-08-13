import { getAddress, isAddress, type Address } from "viem";

const DEFAULT_PLATFORM_REFERRER =
  "0xbFA6A45Dd534d39dF47A3F3D2f2b6E88416f9831";
const configuredPlatformReferrer =
  process.env.NEXT_PUBLIC_DRAWCOIN_PLATFORM_REFERRER?.trim() ||
  DEFAULT_PLATFORM_REFERRER;

if (!isAddress(configuredPlatformReferrer, { strict: false })) {
  throw new Error("NEXT_PUBLIC_DRAWCOIN_PLATFORM_REFERRER is invalid.");
}

export const DRAWCOIN_PLATFORM_REFERRER: Address = getAddress(
  configuredPlatformReferrer
);
