import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Supabase market snapshots have bounded production refresh jobs", async () => {
  const vercel = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8")
  );
  assert.deepEqual(vercel.crons, [
    {
      path: "/api/cron/sync-market?type=active",
      schedule: "10 1 * * *",
    },
    {
      path: "/api/cron/sync-market?type=stale",
      schedule: "40 1 * * *",
    },
  ]);

  const route = await readFile(
    new URL("../src/app/api/cron/sync-market/route.ts", import.meta.url),
    "utf8"
  );
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /mapWithConcurrency\(addresses, 8/);
  assert.match(route, /AbortSignal\.timeout\(45_000\)/);
  assert.doesNotMatch(route, /Promise\.all\(updatePromises\)/);
  assert.doesNotMatch(route, /data\.totalVolume/);
  assert.match(route, /current_price:[\s\S]*?priceUsd : null/);
  assert.match(route, /volume_24h:[\s\S]*?volume : null/);
  assert.match(route, /Number\.isInteger\(holders\)/);
});
