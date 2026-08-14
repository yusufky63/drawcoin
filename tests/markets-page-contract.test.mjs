import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/components/market/MarketsPage.tsx", import.meta.url),
  "utf8",
);
const galleryCardSource = source.slice(
  source.indexOf("const MarketGalleryCard"),
  source.indexOf("const MarketsGallery"),
);

test("markets uses only DrawCoin's Supabase market and identity routes", () => {
  assert.match(source, /`\/api\/market\?\$\{params\.toString\(\)\}`/);
  assert.match(source, /\/api\/basenames\?addresses=/);
  assert.doesNotMatch(source, /\/api\/zora|zoraService|getCoinsTop|getCoinsNew/);
});

test("markets exposes URL-backed discovery and activity ordering", () => {
  assert.match(source, /type MarketsSort =/);
  assert.match(source, /"recently-traded"/);
  assert.match(source, /"most-traded"/);
  assert.match(source, /"most-holders"/);
  assert.match(source, /"most-watched"/);
  assert.match(source, /"volume-high"/);
  assert.match(source, /window\.history\.replaceState\(null, "", `\/markets/);
  assert.match(source, /\["newest", "New", Clock3\]/);
  assert.match(source, /\["market-cap", "Market Cap", TrendingUp\]/);
  assert.match(source, /\["recently-traded", "Recent trades", Activity\]/);
});

test("markets removes technical copy and keeps the view in URL state", () => {
  assert.doesNotMatch(source, /Supabase market index/i);
  assert.doesNotMatch(source, /Supabase snapshot|persisted Base market data/i);
  assert.match(source, /type MarketsView = "table" \| "gallery"/);
  assert.match(source, /params\.get\("view"\)/);
  assert.match(source, /params\.set\("view", view\)/);
  assert.match(source, /aria-pressed=\{view === value\}/);
  assert.match(source, /Show \$\{label\.toLowerCase\(\)\} view/);
});

test("gallery reuses loaded pages in a memoized stable-frame masonry", () => {
  assert.match(source, /const MarketGalleryCard = memo/);
  assert.match(source, /const MarketsGallery = memo/);
  assert.match(
    source,
    /columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4/,
  );
  assert.match(source, /break-inside-avoid/);
  assert.match(source, /galleryAspectClass/);
  assert.match(source, /<SafeImage[\s\S]*?fluid[\s\S]*?lazy=\{!eager\}/);
  assert.match(source, /<CreationTypeBadge/);
  assert.match(source, /!bg-\[#ffd166\]/);
  assert.doesNotMatch(source, /gradient/);
  assert.match(source, /activity, creationType, debouncedSearch, sort, urlReady/);
  assert.doesNotMatch(source, /Minimum holders|minHolders/);
});

test("gallery reserves artwork space before images load", () => {
  assert.match(source, /aspect-\[4\/5\]/);
  assert.match(source, /aspect-square/);
  assert.match(source, /aspect-\[5\/4\]/);
  assert.match(galleryCardSource, /fluid/);
  assert.doesNotMatch(galleryCardSource, /\bnatural\b/);
});

test("markets shares the global Base CTA color tokens", () => {
  assert.match(source, /var\(--base-blue\)/);
  assert.match(source, /var\(--base-blue-hover\)/);
  assert.match(source, /var\(--base-blue-soft\)/);
  assert.doesNotMatch(source, /#0052ff|#003ecb|#eef3ff/i);
});

test("gallery exposes creator and useful market metrics without new providers", () => {
  assert.match(source, /creatorLabel \? `by \$\{creatorLabel\}`/);
  assert.match(source, /formatCompactUsd\(coin\.marketCap\)/);
  assert.match(source, /formatInteger\(coin\.holders\)/);
  assert.match(source, /formatInteger\(coin\.watchlist_count\)/);
  assert.doesNotMatch(source, /\/api\/zora|zoraService|getCoinsTop|getCoinsNew/);
});

test("gallery and table expose watchlist actions without redundant View buttons", () => {
  assert.match(source, /useWatchlist\(\)/);
  assert.match(source, /onToggleWatchlist/);
  assert.match(source, /aria-pressed=\{isWatchlisted\}/);
  assert.match(source, /Saved/);
  assert.match(source, /Watch/);
  assert.doesNotMatch(source, />\s*View\s*</);
});

test("only the table region owns horizontal overflow on narrow screens", () => {
  assert.match(source, /no-scrollbar max-w-full overflow-x-auto/);
  assert.match(source, /table className="w-full min-w-\[1080px\]/);
  assert.doesNotMatch(source, /min-w-\[1080px\].*overflow-x-auto/);
  assert.equal(source.match(/overflow-x-auto/g)?.length, 1);
});

test("markets renders every requested persisted metric honestly", () => {
  for (const label of [
    "Creator",
    "Market cap",
    "24h volume",
    "Holders",
    "Watchlists",
    "Last trade",
    "Age",
  ]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /formatCompactUsd\(coin\.marketCap\)/);
  assert.match(source, /formatCompactUsd\(coin\.volume24h\)/);
  assert.match(source, /formatInteger\(coin\.holders\)/);
  assert.match(source, /formatInteger\(coin\.watchlist_count\)/);
});
