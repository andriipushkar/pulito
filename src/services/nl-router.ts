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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
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
  // Generic: phone-like → search.
  {
    match: (q) => /\d{7,}/.test(q),
    intent: (q) => {
      const match = /\d{7,}/.exec(q);
      const phone = match ? match[0] : '';
      return {
        url: `/admin/orders?search=${encodeURIComponent(phone)}`,
        label: `Пошук за номером ${phone}`,
      };
    },
  },
];

export function matchIntent(query: string): Intent | null {
  const q = query.trim();
  if (!q) return null;
  for (const rule of RULES) {
    if (rule.match(q)) return rule.intent(q);
  }
  return null;
}
