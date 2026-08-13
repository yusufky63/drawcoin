import assert from "node:assert/strict";
import test from "node:test";

import nextConfig from "../next.config.js";
import { getSafeImageRenderStrategy } from "../src/components/ui/safeImagePolicy.ts";

const choiceCdnImage =
  "https://scontent-iad4-1.choicecdn.com/-/rs:fit:600:600/f:best/example";

test("dynamic external artwork bypasses the Next image optimizer", () => {
  assert.equal(getSafeImageRenderStrategy(choiceCdnImage), "native");
  assert.equal(
    getSafeImageRenderStrategy(
      "https://scontent-fra3-2.choicecdn.com/-/rs:fit:600:600/example",
    ),
    "native",
  );
  assert.equal(
    getSafeImageRenderStrategy("https://images.example.test/art.png"),
    "native",
  );
  assert.equal(
    getSafeImageRenderStrategy("//images.example.test/art.png"),
    "native",
  );
});

test("only configured application and profile image sources use Next Image", () => {
  assert.equal(getSafeImageRenderStrategy("/badges/first-stroke.png"), "next");
  assert.equal(
    getSafeImageRenderStrategy(
      "https://pbs.twimg.com/profile_images/123/avatar.jpg",
    ),
    "next",
  );
  assert.equal(
    getSafeImageRenderStrategy("https://pbs.twimg.com/media/art.jpg"),
    "native",
  );
  assert.equal(
    getSafeImageRenderStrategy(
      "https://pbs.twimg.com.evil.test/profile_images/123/avatar.jpg",
    ),
    "native",
  );
});

test("browser-only image sources stay native and unsafe schemes are rejected", () => {
  assert.equal(
    getSafeImageRenderStrategy("data:image/png;base64,iVBORw0KGgo="),
    "native",
  );
  assert.equal(getSafeImageRenderStrategy("blob:https://drawcoin.app/id"), "native");
  assert.equal(getSafeImageRenderStrategy("javascript:alert(1)"), "invalid");
  assert.equal(getSafeImageRenderStrategy("not a url"), "invalid");
});

test("Next Image config does not proxy arbitrary Choice CDN hosts", () => {
  const patterns = nextConfig.images?.remotePatterns ?? [];

  assert.equal(
    patterns.some(({ hostname }) => hostname.includes("choicecdn.com")),
    false,
  );
  assert.deepEqual(patterns, [
    {
      protocol: "https",
      hostname: "pbs.twimg.com",
      pathname: "/profile_images/**",
    },
  ]);
});
