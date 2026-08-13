import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  marketPageSource,
  tokenFiltersSource,
  tokenTickerSource,
  watchlistSource,
  creationTypeBadgeSource,
  leaderboardSource,
] =
  await Promise.all([
    readFile(
      new URL("../src/components/market/MarketPage.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/market/TokenFilters.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/market/TokenTicker.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/hooks/useWatchlist.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../src/components/market/CreationTypeBadge.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/leaderboard/LeaderboardPage.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

test("public market controls only expose database-consistent sorts", () => {
  for (const staleSort of [
    "price-high",
    "price-low",
    "volume-high",
    "holders-high",
  ]) {
    assert.doesNotMatch(tokenFiltersSource, new RegExp(staleSort));
    assert.doesNotMatch(marketPageSource, new RegExp(staleSort));
  }
});

test("watchlist toggles use case-insensitive identity and refresh server counts", () => {
  assert.match(watchlistSource, /tokenAddress\.toLowerCase\(\)/);
  assert.match(watchlistSource, /item\.toLowerCase\(\) === normalizedAddress/);
  assert.match(watchlistSource, /Promise<boolean>/);
  assert.match(marketPageSource, /await toggleWatchlist\(tokenAddress, priceHint\)/);
  assert.match(marketPageSource, /setWatchlistStatsRefresh/);
});

test("ticker moves without exposing a horizontal scrollbar", () => {
  assert.match(tokenTickerSource, /drawcoin-ticker-marquee 42s linear infinite/);
  assert.match(tokenTickerSource, /\.ticker-paused/);
  assert.match(tokenTickerSource, /Resume market ticker/);
  assert.match(tokenTickerSource, /scrollbar-width: none/);
  assert.match(tokenTickerSource, /animation-duration: 72s !important/);
  assert.match(tokenTickerSource, /animation-iteration-count: infinite !important/);
  assert.doesNotMatch(tokenTickerSource, /overflow-x: auto/);
});

test("creation provenance badges use the shared bordered visual language", () => {
  assert.match(creationTypeBadgeSource, /bg-\[#ffd166\]/);
  assert.match(creationTypeBadgeSource, /border-art-gray-900/);
  assert.match(creationTypeBadgeSource, /shadow-\[2px_2px_0_#171717\]/);
  assert.match(creationTypeBadgeSource, /AI Archive/);
  assert.match(creationTypeBadgeSource, /bg-\[#e8e5ff\]/);
});

test("leaderboard tabs fit the mobile card without a nested scroller", () => {
  assert.match(leaderboardSource, /grid grid-cols-2 gap-2/);
  assert.doesNotMatch(
    leaderboardSource,
    /flex gap-2 overflow-x-auto pb-2 md:pb-0/,
  );
});
