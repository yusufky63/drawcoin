import assert from "node:assert/strict";
import test from "node:test";

import { applyCanonicalBadgeClaim } from "../src/lib/badges/reconciliationPolicy.ts";

function createPersistenceHarness(options?: { notificationThrows?: boolean }) {
  let claimed = false;
  let notificationReserved = false;
  let persistCalls = 0;
  let notificationCalls = 0;

  return {
    effects: {
      persist: async ({
        reserveNotification,
      }: {
        reserveNotification: boolean;
      }) => {
        persistCalls += 1;
        const newlyClaimed = !claimed;
        claimed = true;

        const shouldNotify = reserveNotification && !notificationReserved;
        if (shouldNotify) notificationReserved = true;

        return { newlyClaimed, shouldNotify };
      },
      notify: async () => {
        notificationCalls += 1;
        if (options?.notificationThrows) throw new Error("network timeout");
        return { delivered: true };
      },
    },
    counts: () => ({ persistCalls, notificationCalls }),
  };
}

test("does not persist when canonical contract state is unclaimed", async () => {
  const harness = createPersistenceHarness();
  const result = await applyCanonicalBadgeClaim(
    { onchainClaimed: false, notificationsConfigured: true },
    harness.effects
  );

  assert.equal(result.claimed, false);
  assert.deepEqual(harness.counts(), {
    persistCalls: 0,
    notificationCalls: 0,
  });
});

test("repeated and concurrent reconciliation notifies at most once", async () => {
  const harness = createPersistenceHarness();
  const input = { onchainClaimed: true, notificationsConfigured: true };

  const [first, second] = await Promise.all([
    applyCanonicalBadgeClaim(input, harness.effects),
    applyCanonicalBadgeClaim(input, harness.effects),
  ]);
  const third = await applyCanonicalBadgeClaim(input, harness.effects);

  assert.equal([first, second].filter((result) => result.newlyClaimed).length, 1);
  assert.equal(
    [first, second, third].filter(
      (result) => result.notification.attempted
    ).length,
    1
  );
  assert.deepEqual(harness.counts(), {
    persistCalls: 3,
    notificationCalls: 1,
  });
});

test("disabled notifications do not consume the future reservation", async () => {
  const harness = createPersistenceHarness();

  const disabled = await applyCanonicalBadgeClaim(
    { onchainClaimed: true, notificationsConfigured: false },
    harness.effects
  );
  const enabledLater = await applyCanonicalBadgeClaim(
    { onchainClaimed: true, notificationsConfigured: true },
    harness.effects
  );

  assert.equal(disabled.notification.attempted, false);
  assert.equal(enabledLater.notification.attempted, true);
  assert.equal(enabledLater.notification.delivered, true);
  assert.equal(harness.counts().notificationCalls, 1);
});

test("an ambiguous notification failure is never retried", async () => {
  const harness = createPersistenceHarness({ notificationThrows: true });
  const input = { onchainClaimed: true, notificationsConfigured: true };

  const first = await applyCanonicalBadgeClaim(input, harness.effects);
  const second = await applyCanonicalBadgeClaim(input, harness.effects);

  assert.deepEqual(first.notification, {
    configured: true,
    attempted: true,
    delivered: false,
  });
  assert.equal(second.notification.attempted, false);
  assert.equal(harness.counts().notificationCalls, 1);
});
