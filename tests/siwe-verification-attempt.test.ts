import assert from "node:assert/strict";
import test from "node:test";
import { runSiweVerificationAttempt } from "../src/lib/auth/siweVerification.ts";

test("an invalid signature burns the nonce and replay skips signature RPC", async () => {
  const availableNonces = new Set(["nonce-hash"]);
  let signatureChecks = 0;

  const consumeNonce = async (nonceHash: string) =>
    availableNonces.delete(nonceHash);
  const verifyInvalidSignature = async () => {
    signatureChecks += 1;
    return false;
  };

  assert.equal(
    await runSiweVerificationAttempt({
      nonceHash: "nonce-hash",
      consumeNonce,
      verifySignature: verifyInvalidSignature,
    }),
    "signature_invalid"
  );
  assert.equal(signatureChecks, 1);

  assert.equal(
    await runSiweVerificationAttempt({
      nonceHash: "nonce-hash",
      consumeNonce,
      verifySignature: async () => {
        throw new Error("replay must not reach signature verification");
      },
    }),
    "nonce_rejected"
  );
  assert.equal(signatureChecks, 1);
});

test("a nonce-store failure is fail-closed before signature verification", async () => {
  let signatureChecks = 0;

  await assert.rejects(
    runSiweVerificationAttempt({
      nonceHash: "nonce-hash",
      consumeNonce: async () => {
        throw new Error("nonce store unavailable");
      },
      verifySignature: async () => {
        signatureChecks += 1;
        return true;
      },
    }),
    /nonce store unavailable/
  );
  assert.equal(signatureChecks, 0);
});
