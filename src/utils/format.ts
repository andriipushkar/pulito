const KYIV_TZ = 'Europe/Kyiv';

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 2,
  }).format(price);
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
 * Returns today's Kyiv date as a YYYY-MM-DD string. Prefer this over
 * `todayKyiv().toISOString().slice(0,10)` — the ISO form is UTC-based, so
 * between Kyiv 00:00 and Kyiv 02–03:00 it yields yesterday's date.
 */
export function todayKyivIso(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: KYIV_TZ });
}

/**
 * Returns "today midnight" in Kyiv timezone as a UTC Date.
 * Use for analytics/cron date boundaries so "today" always means Kyiv day.
 */
export function todayKyiv(): Date {
  const now = new Date();
  const kyivDate = now.toLocaleDateString('sv-SE', { timeZone: KYIV_TZ }); // "YYYY-MM-DD"
  // Determine Kyiv UTC offset via Intl (handles DST automatically)
  const noonUtc = new Date(`${kyivDate}T12:00:00Z`);
  const kyivHourAtNoonUtc = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: KYIV_TZ,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(noonUtc),
  );
  const offsetHours = kyivHourAtNoonUtc - 12; // +2 (winter) or +3 (summer)
  // Kyiv midnight in UTC = subtract offset from midnight
  const midnight = new Date(`${kyivDate}T00:00:00Z`);
  midnight.setUTCHours(-offsetHours);
  return midnight;
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
