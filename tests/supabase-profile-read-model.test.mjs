import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [leaderboardSource, activitySource, analyticsSource] = await Promise.all([
  readFile(
    new URL("../src/components/leaderboard/LeaderboardPage.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../src/components/activity/ActivityFeed.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../src/services/analyticsService.ts", import.meta.url),
    "utf8",
  ),
]);

test("leaderboard and activity profiles have no render-time provider requests", () => {
  const renderSources = `${leaderboardSource}\n${activitySource}`;

  assert.doesNotMatch(renderSources, /\/api\/zora\/profiles/);
  assert.doesNotMatch(renderSources, /\/api\/farcaster\/users/);
  assert.doesNotMatch(renderSources, /profileEnrichmentService/);
});

test("Supabase leaderboard rows include persisted profile fields", () => {
  assert.match(
    analyticsSource,
    /select\("address, username, avatar_url, total_buy_volume"\)/,
  );
  assert.match(leaderboardSource, /user\.username\?\.trim\(\)/);
  assert.match(leaderboardSource, /user\.avatar_url\?\.trim\(\)/);
  assert.match(analyticsSource, /total_volume_usd: user\.total_buy_volume/);
});

test("activity cards use the users join already returned by Supabase", () => {
  assert.match(
    analyticsSource,
    /user:users!transactions_user_address_fkey\(username, avatar_url\)/,
  );
  assert.match(activitySource, /activity\.user\?\.username\?\.trim\(\)/);
  assert.match(activitySource, /activity\.user\?\.avatar_url\?\.trim\(\)/);
});
