/**
 * Money arithmetic on integer kopecks.
 *
 * Why this exists: every monetary amount in the app is UAH with 2 decimal
 * places, but JS `number` is IEEE-754 float — `0.1 + 0.2 === 0.30000000000004`.
 * Doing money math directly in float and rounding at the end is correct *most*
 * of the time, but the correctness is incidental: it relies on every call site
 * remembering to round, and on the `Decimal(10,2)` DB columns clamping on write.
 *
 * This module makes it structural: convert to integer kopecks at the boundary,
 * do all arithmetic on integers (always exact), convert back to a 2-dp UAH
 * number only when handing the value to the DB / a provider / the UI.
 *
 * Amounts stay plain UAH `number`s at the boundaries so call sites barely change;
 * the exactness lives inside these helpers.
 */

/** Anything that can stand in for a money amount: a UAH number, a numeric string, or a Prisma.Decimal. */
export type MoneyInput = number | string | { toString(): string };

/** UAH amount → integer kopecks. Rounds to the nearest kopeck, absorbing float drift. */
export function toCents(value: MoneyInput): number {
  return Math.round(Number(value) * 100);
}

/** Integer kopecks → UAH amount (exactly 2 dp). */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/** Round a UAH amount to kopecks (2 dp). Use at any boundary that escapes a Decimal column. */
export function round2(value: MoneyInput): number {
  return fromCents(toCents(value));
}

/** price (UAH) × integer quantity → exact UAH amount. */
export function lineTotal(price: MoneyInput, quantity: number): number {
  return fromCents(toCents(price) * Math.trunc(quantity));
}

/** Sum UAH amounts exactly (accumulates in kopecks). */
export function sumMoney(values: MoneyInput[]): number {
  return fromCents(values.reduce<number>((kopecks, v) => kopecks + toCents(v), 0));
}

/** a + b, exact. */
export function addMoney(a: MoneyInput, b: MoneyInput): number {
  return fromCents(toCents(a) + toCents(b));
}

/** a − b, exact. */
export function subtractMoney(a: MoneyInput, b: MoneyInput): number {
  return fromCents(toCents(a) - toCents(b));
}

/**
 * `percent`% of a UAH amount, rounded to the nearest kopeck.
 * e.g. percentOf(100.55, 10) === 10.06 (1005.5 kopecks → 1006).
 */
export function percentOf(amount: MoneyInput, percent: number): number {
  return fromCents(Math.round((toCents(amount) * percent) / 100));
}

/** Compare two amounts exactly: -1 if a < b, 0 if equal (to the kopeck), 1 if a > b. */
export function compareMoney(a: MoneyInput, b: MoneyInput): -1 | 0 | 1 {
  const ca = toCents(a);
  const cb = toCents(b);
  return ca < cb ? -1 : ca > cb ? 1 : 0;
}

/** Smallest of the given amounts (kopeck-exact). */
export function minMoney(...values: MoneyInput[]): number {
  return fromCents(Math.min(...values.map(toCents)));
}

/** Largest of the given amounts (kopeck-exact). */
export function maxMoney(...values: MoneyInput[]): number {
  return fromCents(Math.max(...values.map(toCents)));
}

/** Clamp an amount into [lo, hi] (kopeck-exact). */
export function clampMoney(value: MoneyInput, lo: MoneyInput, hi: MoneyInput): number {
  return fromCents(Math.min(Math.max(toCents(value), toCents(lo)), toCents(hi)));
}
