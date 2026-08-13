const UNAVAILABLE_MESSAGE_PATTERN =
  /temporarily unavailable|failed to fetch|network|configuration|configured/i;
const REJECTED_MESSAGE_PATTERN = /rejected|denied|cancelled|canceled/i;

export function getWalletVerificationHint(error: unknown): string {
  const message = error instanceof Error ? error.message : "";

  if (REJECTED_MESSAGE_PATTERN.test(message)) {
    return "Signature cancelled. No changes were made.";
  }

  if (UNAVAILABLE_MESSAGE_PATTERN.test(message)) {
    return "Wallet verification is not ready here yet. You can keep browsing missions.";
  }

  return "Wallet verification was not completed. You can keep browsing and try again when ready.";
}
