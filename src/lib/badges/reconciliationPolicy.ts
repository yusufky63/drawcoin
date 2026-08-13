export type BadgeClaimPersistenceResult = {
  newlyClaimed: boolean;
  shouldNotify: boolean;
};

export type CanonicalBadgeClaimResult = {
  claimed: boolean;
  newlyClaimed: boolean;
  notification: {
    configured: boolean;
    attempted: boolean;
    delivered: boolean;
  };
};

type CanonicalBadgeClaimEffects = {
  persist: (options: {
    reserveNotification: boolean;
  }) => Promise<BadgeClaimPersistenceResult>;
  notify: () => Promise<{ delivered: boolean }>;
};

/**
 * Applies a canonical contract claim to offchain state. Notification delivery
 * only runs after persistence has atomically reserved the single allowed
 * attempt, so concurrent or repeated reconciliation remains idempotent.
 */
export async function applyCanonicalBadgeClaim(
  input: {
    onchainClaimed: boolean;
    notificationsConfigured: boolean;
  },
  effects: CanonicalBadgeClaimEffects
): Promise<CanonicalBadgeClaimResult> {
  if (!input.onchainClaimed) {
    return {
      claimed: false,
      newlyClaimed: false,
      notification: {
        configured: input.notificationsConfigured,
        attempted: false,
        delivered: false,
      },
    };
  }

  const persistence = await effects.persist({
    reserveNotification: input.notificationsConfigured,
  });

  if (!persistence.shouldNotify) {
    return {
      claimed: true,
      newlyClaimed: persistence.newlyClaimed,
      notification: {
        configured: input.notificationsConfigured,
        attempted: false,
        delivered: false,
      },
    };
  }

  try {
    const delivery = await effects.notify();
    return {
      claimed: true,
      newlyClaimed: persistence.newlyClaimed,
      notification: {
        configured: true,
        attempted: true,
        delivered: delivery.delivered,
      },
    };
  } catch {
    // The reservation deliberately remains consumed after an ambiguous network
    // failure. This provides at-most-once delivery instead of risking duplicates.
    return {
      claimed: true,
      newlyClaimed: persistence.newlyClaimed,
      notification: {
        configured: true,
        attempted: true,
        delivered: false,
      },
    };
  }
}
