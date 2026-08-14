import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [tickerRouteSource, tickerSource, heroSource, marketPageSource] =
  await Promise.all([
    readFile(
      new URL("../src/app/api/market/ticker/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/market/TokenTicker.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/home/HomeHero.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/market/MarketPage.tsx", import.meta.url),
      "utf8",
    ),
  ]);

test("ticker identities and metrics come only from Supabase snapshots", () => {
  assert.match(tickerRouteSource, /\.from\("transactions"\)/);
  assert.match(tickerRouteSource, /\.from\("drawcoins"\)/);
  assert.match(tickerRouteSource, /current_price/);
  assert.match(tickerRouteSource, /total_supply/);
  assert.match(tickerRouteSource, /buildTickerTokens/);
  assert.doesNotMatch(tickerRouteSource, /zora/i);
  assert.doesNotMatch(tickerRouteSource, /getCoinsBatchWithRetry/);
});

test("ticker queries are parallel, deterministic, bounded, and cached", () => {
  assert.match(tickerRouteSource, /await Promise\.all/);
  assert.match(
    tickerRouteSource,
    /\.order\("timestamp"[\s\S]*?\.order\("id"/,
  );
  assert.match(
    tickerRouteSource,
    /\.order\("created_at"[\s\S]*?\.order\("id"/,
  );
  assert.match(tickerRouteSource, /BoundedTtlCache/);
  assert.match(tickerRouteSource, /\.abortSignal\(controller\.signal\)/);
});

test("ticker visibly labels market cap and holders without price", () => {
  assert.match(tickerSource, />\s*MC\s*</);
  assert.match(tickerSource, />\s*Holders\s*</);
  assert.doesNotMatch(tickerSource, />Price</);
  assert.match(tickerSource, /aria-label=.*accessibleMetrics/);
  assert.match(tickerSource, /h-10/);
  assert.match(tickerSource, /keepPreviousData: true/);
  assert.match(tickerSource, /\{token\.name\}/);
  assert.doesNotMatch(tickerSource, /\$\{token\.symbol\}/);
  assert.match(tickerSource, /src=\{token\.imageUrl \|\| "\/icon\.png"\}/);
  assert.doesNotMatch(tickerSource, /hidden h-5 w-5/);
});

test("home and collection headings use the project Poppins family", () => {
  const heroHeading = heroSource.match(/<h1[\s\S]*?<\/h1>/)?.[0] ?? "";
  const collectionHeading =
    marketPageSource.match(/<h2[^>]*>Fresh from the canvas<\/h2>/)?.[0] ?? "";

  assert.match(heroHeading, /font-art-sans/);
  assert.doesNotMatch(heroHeading, /font-art-display/);
  assert.match(collectionHeading, /font-art-sans/);
  assert.doesNotMatch(collectionHeading, /font-art-display/);
});
