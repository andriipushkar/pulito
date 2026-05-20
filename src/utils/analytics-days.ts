// Shared days-param parser for analytics routes. Bounds prevent OOM-style
// requests (`days=999999`) and reject non-positive values that would break
// halfPeriod / rolling-window math downstream.
export function parseDays(raw: string | number | null | undefined, defaultDays = 30): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return defaultDays;
  return Math.min(Math.floor(n), 365);
}
