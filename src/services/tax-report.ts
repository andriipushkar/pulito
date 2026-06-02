import { prisma } from '@/lib/prisma';

/**
 * ФОП single-tax income report — CASH METHOD.
 *
 * Income is recognised on the date money was RECEIVED (`Payment.paidAt`), per
 * Ukrainian sole-proprietor rules, not on the order date. This module only
 * aggregates the numbers + estimates tax; it does NOT produce a DPS-valid XML
 * (that needs the official XSD) — the figures are entered manually into the
 * Електронний кабінет / Дія, or fed to an XML generator once an XSD exists.
 *
 * Honest limitations surfaced as `warnings`:
 *  - Marketplace payouts (net of commission, on the payout date) are NOT
 *    tracked anywhere in the DB, so marketplace income here is GROSS sales by
 *    paidAt — reconcile with bank statements / your accountant.
 *  - COD income date = when the order was marked paid (money from Nova Poshta),
 *    which may differ from the delivery date.
 *  - Foreign-currency payments would need NBU-rate conversion (not handled).
 */

export type FopGroup = 1 | 2 | 3;

/** Order sources that are marketplaces (vs own/direct channels). */
const MARKETPLACE_SOURCES = ['rozetka', 'prom', 'olx', 'epicentrk'];

export interface TaxReportInput {
  year: number;
  /** 1..4 — omit for a full-year report. */
  quarter?: 1 | 2 | 3 | 4;
  group: FopGroup;
  /** Group 3 rate, % of income (e.g. 5 for 5% no-VAT, 3 for 3%+VAT). */
  ratePercent?: number;
  /** Group 1/2 fixed tax already paid/expected for the period (UAH). */
  fixedTax?: number;
}

export interface IncomeBucket {
  gross: number;
  refunds: number;
  net: number;
  orders: number;
}

export interface TaxReport {
  year: number;
  quarter: number | null;
  periodLabel: string;
  group: FopGroup;
  /** Own channels (web / telegram / viber) — exact cash-method income. */
  direct: IncomeBucket;
  /** Marketplaces — GROSS sales (estimate; payouts not tracked). */
  marketplace: IncomeBucket;
  /** Net income that arrived via COD (накладений платіж) — informational flag. */
  codNet: number;
  /** Net income for the selected period (direct + marketplace). */
  periodIncome: number;
  /** Cumulative net income from Jan 1 to end of period (декларація = YTD). */
  ytdIncome: number;
  /** Estimated tax: group 3 → periodIncome × rate%; group 1/2 → fixedTax. */
  estimatedTax: number;
  ratePercent: number | null;
  /** Annual single-tax income limit for the group (owner-configured, UAH). */
  incomeLimit: number | null;
  /** YTD income as % of the limit (null if no limit set). */
  limitUsedPercent: number | null;
  warnings: string[];
  tin: string;
  name: string;
}

/** Kyiv (Europe/Kyiv) local offset in minutes at the given instant (+120 / +180). */
function kyivOffsetMinutes(at: Date): number {
  const utc = new Date(at.toLocaleString('en-US', { timeZone: 'UTC' }));
  const kyiv = new Date(at.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
  return Math.round((kyiv.getTime() - utc.getTime()) / 60000);
}

/**
 * UTC instant of Kyiv-LOCAL midnight for a calendar date. Tax periods are
 * Ukrainian calendar quarters in Kyiv time — using bare Date.UTC boundaries
 * would push a payment made at e.g. 01:00 Kyiv on Jan 1 into the previous year.
 */
function kyivMidnightUtc(year: number, month0: number, day: number): Date {
  const utcMidnight = new Date(Date.UTC(year, month0, day));
  const offMin = kyivOffsetMinutes(utcMidnight);
  return new Date(utcMidnight.getTime() - offMin * 60000);
}

function quarterRange(year: number, quarter?: 1 | 2 | 3 | 4): { start: Date; end: Date } {
  if (!quarter) {
    return { start: kyivMidnightUtc(year, 0, 1), end: kyivMidnightUtc(year + 1, 0, 1) };
  }
  const startMonth = (quarter - 1) * 3;
  return {
    start: kyivMidnightUtc(year, startMonth, 1),
    end: kyivMidnightUtc(year, startMonth + 3, 1),
  };
}

interface RawAgg {
  direct: IncomeBucket;
  marketplace: IncomeBucket;
  codNet: number;
}

const emptyBucket = (): IncomeBucket => ({ gross: 0, refunds: 0, net: 0, orders: 0 });

/**
 * Cash-method aggregation in [start, end), split direct vs marketplace.
 *  - Income (+): payments RECEIVED in the period (Payment.paidAt).
 *  - Refunds (−): money RETURNED in the period (ReturnRequest.refundedAt) — a
 *    refund reduces income in the period it was paid back, NOT in the period of
 *    the original sale (that's the whole point of the cash method).
 */
async function aggregate(start: Date, end: Date): Promise<RawAgg> {
  const [payments, refunds] = await Promise.all([
    prisma.payment.findMany({
      where: { paymentStatus: 'paid', paidAt: { gte: start, lt: end }, deletedAt: null },
      select: { amount: true, paymentMethod: true, order: { select: { source: true } } },
    }),
    prisma.returnRequest.findMany({
      where: { status: 'refunded', refundedAt: { gte: start, lt: end } },
      select: { orderId: true, totalAmount: true },
    }),
  ]);

  // ReturnRequest has no `order` relation — resolve each refund's channel via
  // its orderId in one extra query.
  const refundOrderIds = [...new Set(refunds.map((r) => r.orderId))];
  const refundOrders = refundOrderIds.length
    ? await prisma.order.findMany({
        where: { id: { in: refundOrderIds } },
        select: { id: true, source: true, totalAmount: true },
      })
    : [];
  const orderById = new Map(refundOrders.map((o) => [o.id, o]));

  const direct = emptyBucket();
  const marketplace = emptyBucket();
  let codNet = 0;

  for (const p of payments) {
    const gross = Number(p.amount);
    const bucket = MARKETPLACE_SOURCES.includes(p.order?.source ?? 'web') ? marketplace : direct;
    bucket.gross += gross;
    bucket.orders += 1;
    if (p.paymentMethod === 'cod') codNet += gross;
  }
  for (const r of refunds) {
    const ord = orderById.get(r.orderId);
    const src = ord?.source ?? 'web';
    const bucket = MARKETPLACE_SOURCES.includes(src) ? marketplace : direct;
    // ReturnRequest.totalAmount is GROSS goods; the customer only paid the net
    // order total (after coupon/loyalty), so cap the income reduction at what
    // was actually charged — gross would over-subtract on discounted orders.
    const netCharged = ord ? Number(ord.totalAmount) : Number(r.totalAmount);
    bucket.refunds += Math.min(Number(r.totalAmount), netCharged);
  }
  direct.net = direct.gross - direct.refunds;
  marketplace.net = marketplace.gross - marketplace.refunds;

  return { direct, marketplace, codNet };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function tidy(b: IncomeBucket): IncomeBucket {
  return {
    gross: round2(b.gross),
    refunds: round2(b.refunds),
    net: round2(b.net),
    orders: b.orders,
  };
}

export async function getTaxReport(input: TaxReportInput): Promise<TaxReport> {
  const { year, quarter, group } = input;
  const ratePercent = input.ratePercent ?? (group === 3 ? 5 : null);

  const { start, end } = quarterRange(year, quarter);
  // YTD start must use the SAME Kyiv-time boundary as the period (was Date.UTC —
  // inconsistent, dropped Jan-1 early-hours payments from the year total).
  const ytdStart = quarterRange(year, 1).start;

  const [period, ytd] = await Promise.all([aggregate(start, end), aggregate(ytdStart, end)]);

  const direct = tidy(period.direct);
  const marketplace = tidy(period.marketplace);
  const periodIncome = round2(direct.net + marketplace.net);
  const ytdIncome = round2(ytd.direct.net + ytd.marketplace.net);

  let estimatedTax = 0;
  if (group === 3) {
    estimatedTax = round2((periodIncome * (ratePercent ?? 0)) / 100);
  } else {
    estimatedTax = round2(input.fixedTax ?? 0);
  }

  const warnings: string[] = [];
  warnings.push(
    'Враховано лише оплати, позначені «оплачено» в Pulito (дата = коли позначено). Замовлення без статусу «оплачено» в дохід НЕ потрапляють — перевірте, що всі надходження відмічені.',
  );
  if (marketplace.orders > 0) {
    warnings.push(
      'Маркетплейс: показано ВАЛОВИЙ продаж відмічених оплаченими замовлень. Реальні виплати (нетто після комісії, дата виплати) не трекаються — звірте з банком.',
    );
  }
  if (period.codNet > 0) {
    warnings.push(
      'Накладений платіж (COD): дата доходу = коли позначено оплаченим (надходження від НП), не дата доставки.',
    );
  }
  warnings.push('Часткові оплати (partial) не враховуються — лише повністю оплачені.');
  warnings.push(
    'Повернення беруться з «Запитів на повернення» (за датою повернення). Прямі повернення в обхід цього потоку тут не відображаються — звірте вручну.',
  );
  if (group !== 3) {
    warnings.push(
      'Для 1/2 групи податок фіксований — введіть суму вручну; дохід тут лише для звірки річного ліміту.',
    );
  }

  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: ['fop_tin', 'fop_name', 'fop_income_limit'] } },
    select: { key: true, value: true },
  });
  const map = new Map(settings.map((s) => [s.key, s.value]));

  // Annual income-limit check (owner sets the current limit for their group —
  // not hardcoded, because the cap changes every year). Exceeding it can drop
  // the FOP off the single-tax system, so warn early.
  const incomeLimit = Number(map.get('fop_income_limit') ?? 0) || null;
  const limitUsedPercent = incomeLimit ? round2((ytdIncome / incomeLimit) * 100) : null;
  if (incomeLimit && limitUsedPercent !== null) {
    if (limitUsedPercent >= 100) {
      warnings.push(
        `⚠️ ПЕРЕВИЩЕНО річний ліміт групи: ${limitUsedPercent}% від ${incomeLimit.toFixed(0)} ₴. Ризик втрати єдиного податку — терміново до бухгалтера.`,
      );
    } else if (limitUsedPercent >= 90) {
      warnings.push(
        `Дохід наблизився до річного ліміту: ${limitUsedPercent}% від ${incomeLimit.toFixed(0)} ₴.`,
      );
    }
  }

  return {
    year,
    quarter: quarter ?? null,
    periodLabel: quarter ? `Q${quarter} ${year}` : `${year} (рік)`,
    group,
    direct,
    marketplace,
    codNet: round2(period.codNet),
    periodIncome,
    ytdIncome,
    estimatedTax,
    ratePercent,
    incomeLimit,
    limitUsedPercent,
    warnings,
    tin: map.get('fop_tin') ?? '',
    name: map.get('fop_name') ?? '',
  };
}

/** Flatten a report to CSV (semicolon-separated for UA Excel). */
export function taxReportToCsv(r: TaxReport): string {
  const rows: Array<[string, string]> = [
    ['Період', r.periodLabel],
    ['Група ФОП', String(r.group)],
    ['ІПН', r.tin],
    ['ПІБ', r.name],
    ['Дохід (сайт) валовий', r.direct.gross.toFixed(2)],
    ['Дохід (сайт) повернення', r.direct.refunds.toFixed(2)],
    ['Дохід (сайт) чистий', r.direct.net.toFixed(2)],
    ['Дохід (маркетплейс) валовий', r.marketplace.gross.toFixed(2)],
    ['Дохід (маркетплейс) повернення', r.marketplace.refunds.toFixed(2)],
    ['Дохід (маркетплейс) чистий', r.marketplace.net.toFixed(2)],
    ['у т.ч. накладений платіж (валовий)', r.codNet.toFixed(2)],
    ['ДОХІД ЗА ПЕРІОД', r.periodIncome.toFixed(2)],
    ['ДОХІД НАРОСТАЮЧИМ З ПОЧАТКУ РОКУ', r.ytdIncome.toFixed(2)],
    ['Орієнтовний податок', r.estimatedTax.toFixed(2)],
    ['Річний ліміт групи', r.incomeLimit != null ? r.incomeLimit.toFixed(2) : '—'],
    ['Використано ліміту, %', r.limitUsedPercent != null ? r.limitUsedPercent.toFixed(1) : '—'],
  ];
  // Escape embedded quotes (CSV doubles them) so a value like `ТОВ "Пуліто"`
  // doesn't break the row.
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  return rows.map(([k, v]) => `${esc(k)};${esc(v)}`).join('\n');
}
