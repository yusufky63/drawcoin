import assert from "node:assert/strict";
import test from "node:test";

import { getWalletVerificationHint } from "../src/lib/auth/walletVerification.ts";

test("wallet verification configuration failures use a quiet browsing-safe hint", () => {
  assert.equal(
    getWalletVerificationHint(
      new Error("Wallet sign-in is temporarily unavailable.")
    ),
    "Wallet verification is not ready here yet. You can keep browsing missions."
  );
});

test("wallet signature rejection is described without an alarm state", () => {
  assert.equal(
    getWalletVerificationHint(new Error("User rejected the request.")),
    "Signature cancelled. No changes were made."
  );
});

test("unexpected verification failures remain fail-soft", () => {
  assert.equal(
    getWalletVerificationHint(new Error("Unknown wallet error")),
    "Wallet verification was not completed. You can keep browsing and try again when ready."
  );
});
