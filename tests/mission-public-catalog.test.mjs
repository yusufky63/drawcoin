import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [serviceSource, pageSource, catalogRouteSource, voucherSource, statusSource] =
  await Promise.all([
    readFile(
      new URL("../src/lib/missions/service.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/missions/MissionsPage.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/app/api/missions/catalog/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/app/api/badges/claim-voucher/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/app/api/badges/status/route.ts", import.meta.url),
      "utf8",
    ),
  ]);

test("the public catalog lists every definition without requiring a wallet session", () => {
  assert.match(serviceSource, /getMissionDefinitions\(false\)/);
  assert.match(pageSource, /useSWR<MissionCatalog>\(\s*"\/api\/missions\/catalog"/);
  assert.doesNotMatch(catalogRouteSource, /requireWalletSession|evaluateMissions/);

  const catalogFunction = serviceSource.slice(
    serviceSource.indexOf("export async function getMissionCatalog"),
    serviceSource.indexOf("async function getMetricValues"),
  );
  assert.doesNotMatch(
    catalogFunction,
    /progress:|completedAt:|claimStatus:|earnedAt:/,
  );
});

test("signed-in progress enriches the public catalog instead of replacing it", () => {
  assert.match(pageSource, /progressByMissionId/);
  assert.match(pageSource, /catalog\.missions\.map/);
  assert.match(
    pageSource,
    /Connect wallet to view progress and claim badges/,
  );
  assert.doesNotMatch(pageSource, /Progress stays private/);
});

test("claim APIs fail closed and persist a submitted transaction as pending", () => {
  assert.match(voucherSource, /badgeMetadataReady/);
  assert.match(voucherSource, /deployable metadata is not ready yet/);
  assert.match(statusSource, /markBadgeClaimPending/);
  assert.match(statusSource, /confirmed: false, pending: true/);
});
