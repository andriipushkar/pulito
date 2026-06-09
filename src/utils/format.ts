const KYIV_TZ = 'Europe/Kyiv';

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 2,
  }).format(price);
}

/**
 * Sum an array of UAH money amounts without binary-float drift. Canonical
 * implementation lives in {@link module:utils/money}; re-exported here for the
 * many display/template call sites that import it from `format`.
 */
export { sumMoney } from '@/utils/money';

/**
 * Escape a string for safe interpolation into an HTML document (e.g. email
 * templates built via string concatenation). Prevents stored values such as
 * product names from injecting markup/script into the rendered HTML.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: KYIV_TZ,
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: KYIV_TZ,
  }).format(new Date(date));
}

/**
 * Returns the Kyiv calendar date of a given instant as a YYYY-MM-DD string.
 * Use for bucketing rows into Kyiv days — `date.toISOString().slice(0,10)` is
 * UTC-based, so an order placed Kyiv 00:00–03:00 buckets into the wrong day.
 */
export function kyivDateIso(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: KYIV_TZ });
}

/**
 * Returns today's Kyiv date as a YYYY-MM-DD string. Prefer this over
 * `todayKyiv().toISOString().slice(0,10)` — the ISO form is UTC-based, so
 * between Kyiv 00:00 and Kyiv 02–03:00 it yields yesterday's date.
 */
export function todayKyivIso(): string {
  return kyivDateIso(new Date());
}

/**
 * Returns the UTC Date corresponding to Kyiv 00:00 of the given calendar date
 * ("YYYY-MM-DD"). DST-aware (Kyiv is UTC+2 in winter, UTC+3 in summer).
 * Use to turn a "YYYY-MM-DD" filter into a Kyiv day boundary instead of a UTC
 * one — otherwise an order placed 00:00–03:00 Kyiv falls into the wrong day.
 */
export function kyivMidnightUtc(dateStr: string): Date {
  // Determine Kyiv UTC offset on that date via Intl (handles DST automatically).
  const noonUtc = new Date(`${dateStr}T12:00:00Z`);
  const kyivHourAtNoonUtc = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: KYIV_TZ,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(noonUtc),
  );
  const offsetHours = kyivHourAtNoonUtc - 12; // +2 (winter) or +3 (summer)
  // Kyiv midnight in UTC = midnight minus the offset.
  const midnight = new Date(`${dateStr}T00:00:00Z`);
  midnight.setUTCHours(-offsetHours);
  return midnight;
}

/**
 * Returns "today midnight" in Kyiv timezone as a UTC Date.
 * Use for analytics/cron date boundaries so "today" always means Kyiv day.
 */
export function todayKyiv(): Date {
  return kyivMidnightUtc(todayKyivIso());
}

/**
 * Exclusive upper bound for an inclusive "to" date ("YYYY-MM-DD"): Kyiv 00:00 of
 * the day *after* dateStr. Pair with `lt` so a date-range filter includes every
 * record on dateStr's Kyiv day (and no part of the next one).
 */
export function kyivNextDayUtc(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return kyivMidnightUtc(d.toISOString().slice(0, 10));
}

/**
 * Returns N days ago midnight in Kyiv timezone as a UTC Date.
 */
export function daysAgoKyiv(days: number): Date {
  const d = todayKyiv();
  d.setDate(d.getDate() - days);
  return d;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

/**
 * Ukrainian plural form selector. Pass three forms: [singular, paucal, plural].
 * Example: plural(5, ['товар', 'товари', 'товарів']) → 'товарів'
 */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/**
 * Return a user-friendly display name: fullName if present, otherwise the part
 * of the email before "@" with first letter uppercased, otherwise "Користувач".
 */
export function displayName(
  user: { fullName?: string | null; email?: string | null } | null | undefined,
): string {
  if (!user) return 'Користувач';
  const full = user.fullName?.trim();
  if (full) return full;
  const email = user.email?.trim();
  if (email) {
    const local = email.split('@')[0] || email;
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return 'Користувач';
}
