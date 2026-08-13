import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [headerSource, gridSource] = await Promise.all([
  readFile(new URL("../src/components/Header.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/market/TokenGrid.tsx", import.meta.url), "utf8"),
]);

test("mobile navigation exposes Markets without crowding the five-slot dock", () => {
  const navigationSource = headerSource.slice(
    headerSource.indexOf("const mobileNavigation"),
    headerSource.indexOf("] as const;", headerSource.indexOf("const mobileNavigation")),
  );

  assert.match(navigationSource, /href: "\/markets"/);
  assert.doesNotMatch(navigationSource, /href: "\/watchlist"/);
  assert.equal((navigationSource.match(/href:/g) ?? []).length, 5);
});

test("mobile wallet identity is a bold direct portfolio link", () => {
  assert.match(headerSource, /href="\/portfolio"\s+aria-label="Open portfolio"/);
  assert.match(headerSource, /truncate text-xs font-bold/);
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
