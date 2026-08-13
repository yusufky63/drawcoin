export type SafeImageRenderStrategy = "next" | "native" | "invalid";

type TrustedNextImagePattern = {
  protocol: "https:";
  hostname: string;
  pathnamePrefix: string;
};

// Keep this intentionally small and aligned with next.config.js. Database image
// URLs are user-controlled, so unknown hosts must be fetched by the browser
// rather than being proxied through the Next.js image optimizer.
const TRUSTED_NEXT_IMAGE_PATTERNS: readonly TrustedNextImagePattern[] = [
  {
    protocol: "https:",
    hostname: "pbs.twimg.com",
    pathnamePrefix: "/profile_images/",
  },
];

const DATA_IMAGE_SOURCE = /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i;

/**
 * Selects an image renderer without consulting browser-only state, keeping the
 * server and the first client render deterministic.
 */
export function getSafeImageRenderStrategy(
  source: string,
): SafeImageRenderStrategy {
  const value = source.trim();

  if (!value) return "invalid";

  // Next/Image handles application-owned public assets. Protocol-relative URLs
  // are external and deliberately excluded from this branch.
  if (value.startsWith("/") && !value.startsWith("//")) return "next";

  // These sources never need the optimizer and can only be resolved in the
  // browser that created or received them.
  if (value.startsWith("blob:") || DATA_IMAGE_SOURCE.test(value)) {
    return "native";
  }

  let url: URL;
  try {
    url = value.startsWith("//")
      ? new URL(value, "https://drawcoin.invalid")
      : new URL(value);
  } catch {
    return "invalid";
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "invalid";
  }

  const canUseNextImage = TRUSTED_NEXT_IMAGE_PATTERNS.some(
    (pattern) =>
      url.protocol === pattern.protocol &&
      url.hostname === pattern.hostname &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname.startsWith(pattern.pathnamePrefix),
  );

  return canUseNextImage ? "next" : "native";
}
