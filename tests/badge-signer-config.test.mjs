import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("badge vouchers use the shared server-only PRIVATE_KEY", async () => {
  const [voucher, envExample, contractReadme, setupGuide] = await Promise.all([
    readFile(new URL("src/lib/badges/voucher.ts", root), "utf8"),
    readFile(new URL(".env.example", root), "utf8"),
    readFile(new URL("contracts/README.md", root), "utf8"),
    readFile(new URL("docs/BASE_APP_MISSIONS_SETUP.md", root), "utf8"),
  ]);

  assert.match(voucher, /process\.env\.PRIVATE_KEY\?\.trim\(\)/);
  assert.doesNotMatch(voucher, /BADGE_CLAIM_SIGNER_PRIVATE_KEY/);
  assert.match(envExample, /^PRIVATE_KEY=0xYOUR_SERVER_ONLY_32_BYTE_PRIVATE_KEY$/m);
  assert.doesNotMatch(envExample, /BADGE_CLAIM_SIGNER_PRIVATE_KEY/);
  assert.doesNotMatch(contractReadme, /BADGE_CLAIM_SIGNER_PRIVATE_KEY/);
  assert.doesNotMatch(setupGuide, /BADGE_CLAIM_SIGNER_PRIVATE_KEY/);
});
