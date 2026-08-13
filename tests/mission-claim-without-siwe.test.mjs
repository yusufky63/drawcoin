import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

const [missionsRoute, voucherRoute, statusRoute, page, service] =
  await Promise.all([
    readFile(new URL("src/app/api/missions/route.ts", root), "utf8"),
    readFile(
      new URL("src/app/api/badges/claim-voucher/route.ts", root),
      "utf8",
    ),
    readFile(new URL("src/app/api/badges/status/route.ts", root), "utf8"),
    readFile(new URL("src/components/missions/MissionsPage.tsx", root), "utf8"),
    readFile(new URL("src/lib/missions/service.ts", root), "utf8"),
  ]);

test("mission progress and badge claims require only a connected address", () => {
  const publicClaimFlow = `${missionsRoute}\n${voucherRoute}\n${statusRoute}`;

  assert.doesNotMatch(publicClaimFlow, /requireWalletSession|SessionError/);
  assert.match(missionsRoute, /searchParams\.get\("address"\)/);
  assert.match(voucherRoute, /createBadgeClaimVoucher\(address, tokenId\)/);
  assert.match(page, /body: JSON\.stringify\(\{ address, missionSlug:/);
  assert.match(page, /isAddressEqual\(voucher\.claim\.account, address\)/);
  assert.doesNotMatch(page, /useWalletSession|signMessage|wallet verification/i);
});

test("unknown addresses cannot create empty mission-state rows", () => {
  assert.match(service, /const hasMissionActivity = Object\.values/);
  assert.match(
    service,
    /const shouldPersistProgress =\s*existingProgress\.length > 0 \|\| hasMissionActivity/,
  );
  assert.match(
    service,
    /if \(shouldPersistProgress && progressRows\.length > 0\)/,
  );
});
