import assert from "node:assert/strict";
import test from "node:test";

import { getMissionClaimAction } from "../src/lib/missions/claimUi.ts";

const readyInput = {
  isCompleted: true,
  claimStatus: "unclaimed" as const,
  isSubmitting: false,
  hasDeployableMetadata: true,
  contractConfigured: true,
};

test("incomplete and claimable missions use clear badge states", () => {
  const incomplete = getMissionClaimAction({
    ...readyInput,
    isCompleted: false,
  });
  assert.equal(incomplete.state, "incomplete");
  assert.equal(incomplete.disabled, true);
  assert.equal(incomplete.label, "In progress");

  const claimable = getMissionClaimAction(readyInput);
  assert.equal(claimable.state, "claimable");
  assert.equal(claimable.disabled, false);
  assert.equal(claimable.label, "Claim badge");
  assert.equal(claimable.message, "Ready to claim.");
});

test("pending and claimed badges cannot submit a duplicate wallet call", () => {
  const pending = getMissionClaimAction({
    ...readyInput,
    claimStatus: "pending",
  });
  assert.equal(pending.state, "pending");
  assert.equal(pending.disabled, true);
  assert.equal(pending.label, "Confirming");

  const claimed = getMissionClaimAction({
    ...readyInput,
    claimStatus: "claimed",
  });
  assert.equal(claimed.state, "claimed");
  assert.equal(claimed.disabled, true);
  assert.equal(claimed.label, "Claimed");
});

test("missing badge metadata or contract configuration fails closed", () => {
  const missingMetadata = getMissionClaimAction({
    ...readyInput,
    hasDeployableMetadata: false,
  });
  assert.equal(missingMetadata.state, "unavailable");
  assert.equal(missingMetadata.disabled, true);
  assert.equal(missingMetadata.label, "Completed");
  assert.equal(missingMetadata.message, "Badge claim is not live yet.");

  const missingContract = getMissionClaimAction({
    ...readyInput,
    contractConfigured: false,
  });
  assert.equal(missingContract.state, "unavailable");
  assert.equal(missingContract.disabled, true);
  assert.equal(missingContract.label, "Completed");
  assert.equal(missingContract.message, "Badge claim is not live yet.");

  const loadingContract = getMissionClaimAction({
    ...readyInput,
    contractConfigured: null,
  });
  assert.equal(loadingContract.state, "unavailable");
  assert.equal(loadingContract.message, "Badge claim is not live yet.");
});

test("a failed wallet claim is explicitly retryable", () => {
  const failed = getMissionClaimAction({
    ...readyInput,
    claimStatus: "failed",
  });
  assert.equal(failed.state, "claimable");
  assert.equal(failed.disabled, false);
  assert.equal(failed.label, "Retry claim");
});
