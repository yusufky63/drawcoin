import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [headerSource, gridSource] = await Promise.all([
  readFile(new URL("../src/components/Header.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/market/TokenGrid.tsx", import.meta.url), "utf8"),
]);

test("mobile navigation keeps core destinations and moves secondary pages into Menu", () => {
  const navigationSource = headerSource.slice(
    headerSource.indexOf("const mobileNavigation"),
    headerSource.indexOf("] as const;", headerSource.indexOf("const mobileNavigation")),
  );

  const menuSource = headerSource.slice(
    headerSource.indexOf("const mobileMenuNavigation"),
    headerSource.indexOf("] as const;", headerSource.indexOf("const mobileMenuNavigation")),
  );

  assert.match(navigationSource, /href: "\/markets"/);
  assert.doesNotMatch(navigationSource, /href: "\/watchlist"/);
  assert.doesNotMatch(navigationSource, /href: "\/missions"/);
  assert.equal((navigationSource.match(/href:/g) ?? []).length, 4);
  assert.match(menuSource, /href: "\/missions"/);
  assert.match(menuSource, /href: "\/leaderboard"/);
  assert.match(headerSource, /id="mobile-more-menu"/);
  assert.match(headerSource, /aria-controls="mobile-more-menu"/);
  assert.match(headerSource, /href="\/watchlist"\s+role="menuitem"/);
});

test("mobile wallet identity is a bold direct portfolio link", () => {
  assert.match(headerSource, /href="\/portfolio"\s+aria-label="Open portfolio"/);
  assert.match(headerSource, /truncate text-xs font-extrabold/);
});

test("list cards render the creation badge beside token identity, not over artwork", () => {
  const logoEnd = gridSource.indexOf("{/* Token Info */}");
  const logoSource = gridSource.slice(
    gridSource.indexOf("{/* Token Logo */}"),
    logoEnd,
  );
  const infoSource = gridSource.slice(logoEnd, gridSource.indexOf("{/* Creator Info */}"));

  assert.doesNotMatch(logoSource, /CreationTypeBadge/);
  assert.match(infoSource, /CreationTypeBadge/);
});
