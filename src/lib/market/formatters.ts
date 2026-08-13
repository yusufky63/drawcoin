const COMPACT_NUMBER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});

const INTEGER_NUMBER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export function finiteNonNegative(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function formatCompactUsd(value: unknown) {
  const number = finiteNonNegative(value);
  if (number === null) return "—";
  if (number < 1) return `$${number.toFixed(number >= 0.01 ? 2 : 4)}`;
  return `$${COMPACT_NUMBER.format(number)}`;
}

export function formatInteger(value: unknown) {
  const number = finiteNonNegative(value);
  return number === null ? "—" : INTEGER_NUMBER.format(Math.floor(number));
}

export function formatCoinAge(value?: string | null, now = Date.now()) {
  if (!value) return "—";
  const createdAt = Date.parse(value);
  if (!Number.isFinite(createdAt)) return "—";

  const elapsedSeconds = Math.max(0, Math.floor((now - createdAt) / 1_000));
  if (elapsedSeconds < 60) return `${elapsedSeconds}s`;
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}
