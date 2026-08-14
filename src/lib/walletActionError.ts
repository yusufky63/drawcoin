type ErrorLike = {
  code?: unknown;
  name?: unknown;
  message?: unknown;
  shortMessage?: unknown;
  details?: unknown;
  cause?: unknown;
};

const REJECTED_PATTERNS = [
  "user rejected",
  "user denied",
  "request rejected",
  "rejected the request",
  "action_rejected",
];

function collectErrorText(error: unknown): string {
  const parts: string[] = [];
  const visited = new Set<unknown>();
  let current: unknown = error;

  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (visited.has(current)) break;
    visited.add(current);

    if (typeof current === "string") {
      parts.push(current);
      break;
    }
    if (typeof current !== "object") break;

    const candidate = current as ErrorLike;
    for (const value of [
      candidate.name,
      candidate.shortMessage,
      candidate.details,
      candidate.message,
    ]) {
      if (typeof value === "string") parts.push(value);
    }
    current = candidate.cause;
  }

  return parts.join(" ").toLowerCase();
}

function getErrorCode(error: unknown): unknown {
  let current: unknown = error;
  const visited = new Set<unknown>();

  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (visited.has(current) || typeof current !== "object") break;
    visited.add(current);
    const candidate = current as ErrorLike;
    if (candidate.code !== undefined) return candidate.code;
    current = candidate.cause;
  }

  return undefined;
}

export function isUserRejectedWalletAction(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code === 4001 || code === "4001" || code === "ACTION_REJECTED") {
    return true;
  }

  const text = collectErrorText(error);
  return REJECTED_PATTERNS.some((pattern) => text.includes(pattern));
}

export function getWalletActionErrorMessage(
  error: unknown,
  options: {
    rejected: string;
    fallback: string;
  }
): string {
  if (isUserRejectedWalletAction(error)) return options.rejected;

  const text = collectErrorText(error);
  if (text.includes("insufficient funds") || text.includes("exceeds balance")) {
    return "Insufficient balance for this transaction.";
  }
  if (text.includes("slippage")) {
    return "Price moved too much. Adjust slippage and try again.";
  }
  if (text.includes("wrong chain") || text.includes("switch to base")) {
    return "Switch your wallet to Base and try again.";
  }

  return options.fallback;
}
