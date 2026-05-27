/**
 * Lightweight natural-language router. Maps Ukrainian admin queries to existing
 * admin URLs. Intentionally NOT a real text-to-SQL — we don't have an LLM SDK
 * installed and shipping raw SQL execution would be a security disaster.
 *
 * If/when @anthropic-ai/sdk lands, swap matchIntent for a Claude call that
 * returns the same { url, label } shape.
 */

export interface Intent {
  /** Where to send the user. */
  url: string;
  /** Human label so the chat can echo what it understood. */
  label: string;
}

/** Max characters the NL router will process. Above this — bail out
 * (regex eval cost + UI freeze risk). Real admin queries are ≤80 chars. */
export const MAX_QUERY_LENGTH = 500;

/** Return today's date in `YYYY-MM-DD` using Europe/Kyiv (store timezone).
 * Plain `toISOString().slice(0,10)` would shift to yesterday after 22:00
 * Kyiv during winter and 21:00 during summer (UTC offset). */
function today(): string {
  return kyivDateString(new Date());
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return kyivDateString(d);
}

function kyivDateString(d: Date): string {
  // `sv-SE` formatting gives `YYYY-MM-DD HH:mm:ss`; we take the date part.
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Block intent URLs that aren't internal admin paths. Today every rule
 * returns a `/admin/...` URL, but once a future Claude integration starts
 * generating URLs the guard prevents open-redirect / phishing. */
function isSafeIntentUrl(url: string): boolean {
  return url.startsWith('/admin/') && !url.includes('//');
}

const RULES: { match: (q: string) => boolean; intent: (q: string) => Intent }[] = [
  // Orders by time.
  {
    match: (q) => /(сьогодні|today)/i.test(q) && /замовлен/i.test(q),
    intent: () => ({
      url: `/admin/orders?dateFrom=${today()}`,
      label: `Замовлення за сьогодні (${today()})`,
    }),
  },
  {
    match: (q) => /(тиждень|7\s*днів|7 day)/i.test(q) && /замовлен/i.test(q),
    intent: () => ({
      url: `/admin/orders?dateFrom=${daysAgo(7)}`,
      label: 'Замовлення за останні 7 днів',
    }),
  },
  {
    match: (q) => /(місяць|30\s*днів)/i.test(q) && /замовлен/i.test(q),
    intent: () => ({
      url: `/admin/orders?dateFrom=${daysAgo(30)}`,
      label: 'Замовлення за останні 30 днів',
    }),
  },
  // Orders by status.
  {
    match: (q) => /нов(і|их)\s*замовлен/i.test(q),
    intent: () => ({ url: '/admin/orders?status=new_order', label: 'Нові замовлення' }),
  },
  {
    match: (q) => /неоплачен/i.test(q),
    intent: () => ({
      url: '/admin/orders?paymentStatus=pending',
      label: 'Неоплачені замовлення',
    }),
  },
  {
    match: (q) => /відправлен/i.test(q),
    intent: () => ({ url: '/admin/orders?status=shipped', label: 'Відправлені замовлення' }),
  },
  // Inventory.
  {
    match: (q) => /(нема|без)\s*(в наявності|stock|залишк)/i.test(q),
    intent: () => ({ url: '/admin/products?stock=out', label: 'Товари без залишку' }),
  },
  {
    match: (q) => /низьк(і|их)\s*залишк/i.test(q) || /(low\s*stock)/i.test(q),
    intent: () => ({ url: '/admin/products?stock=low', label: 'Товари з низьким залишком' }),
  },
  {
    match: (q) => /товар(и|ів)?\s*без\s*фото/i.test(q),
    intent: () => ({ url: '/admin/products?hasImage=false', label: 'Товари без фото' }),
  },
  // Customers.
  {
    match: (q) => /клієнт(и|ів)?\s*з\s*київ/i.test(q),
    intent: () => ({ url: '/admin/users?search=Київ', label: 'Клієнти з Києва' }),
  },
  {
    match: (q) => /гуртов/i.test(q),
    intent: () => ({
      url: '/admin/users?wholesaleStatus=pending',
      label: 'Очікують підтвердження опту',
    }),
  },
  // Generic: phone-like → search. Tightened to Ukrainian formats so a 7-digit
  // order number or timestamp doesn't accidentally route into phone search.
  // Matches `+380XXXXXXXXX`, `380XXXXXXXXX`, or 10-12 digit local numbers.
  {
    match: (q) => /(\+?380\d{9}|\b\d{10,12}\b)/.test(q),
    intent: (q) => {
      const match = /(\+?380\d{9}|\b\d{10,12}\b)/.exec(q);
      const phone = match ? match[0] : '';
      return {
        url: `/admin/orders?search=${encodeURIComponent(phone)}`,
        label: `Пошук за номером ${phone}`,
      };
    },
  },
];

export function matchIntent(query: string): Intent | null {
  // Strip control chars and cap length before any regex eval. A 10MB paste
  // would otherwise freeze the UI thread for seconds.

  const cleaned = query.replace(/[\x00-\x1F\x7F]/g, ' ').slice(0, MAX_QUERY_LENGTH);
  const q = cleaned.trim();
  if (!q) return null;
  for (const rule of RULES) {
    if (rule.match(q)) {
      const intent = rule.intent(q);
      // Defensive: today every rule returns `/admin/...`, but the guard
      // future-proofs the entry point when LLM-generated intents land.
      if (!isSafeIntentUrl(intent.url)) return null;
      return intent;
    }
  }
  return null;
}
