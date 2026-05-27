'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import { MARKETPLACES, MARKETPLACE_BY_KEY } from '../_shared';

interface PlatformStats {
  platform: string;
  orders: number;
  revenue: number;
  commissionPercent: number;
  commission: number;
  netRevenue: number;
  avgOrder: number;
  publishedCount: number;
}

interface TopProduct {
  productCode: string;
  productName: string;
  quantity: number;
  revenue: number;
}

interface AnalyticsResponse {
  period: string;
  totals: {
    orders: number;
    revenue: number;
    commission: number;
    netRevenue: number;
    avgOrder: number;
  };
  previousTotals?: { orders: number; revenue: number };
  platforms: PlatformStats[];
  topProducts: Record<string, TopProduct[]>;
  daily: { day: string; revenue: number; orders: number }[];
}

// Render a small "+X% vs попередні" badge. Returns null when there's no
// previous-period value to compare against (e.g. first month of operation).
function DeltaBadge({ current, previous }: { current: number; previous: number | undefined }) {
  if (previous == null) return null;
  if (previous === 0) {
    if (current === 0) return null;
    return (
      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
        ▲ нове
      </span>
    );
  }
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct * 10) / 10;
  const tone =
    rounded > 0
      ? 'bg-green-100 text-green-700'
      : rounded < 0
        ? 'bg-red-100 text-red-700'
        : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]';
  const arrow = rounded > 0 ? '▲' : rounded < 0 ? '▼' : '—';
  return (
    <span
      title={`Попередні ${current >= previous ? '+' : ''}${rounded}% (${previous})`}
      className={`ml-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tone}`}
    >
      {arrow} {rounded >= 0 ? '+' : ''}
      {rounded}%
    </span>
  );
}

export function AnalyticsTab() {
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  // Derive isLoading from completedPeriod: loading until the completed period matches the requested one.
  const [completedPeriod, setCompletedPeriod] = useState<string | null>(null);
  const isLoading = completedPeriod !== period;

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<AnalyticsResponse>(`/api/v1/admin/marketplaces/analytics?period=${period}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setData(res.data);
        else toast.error(res.error || 'Не вдалося завантажити аналітику');
      })
      .finally(() => {
        if (!cancelled) setCompletedPeriod(period);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  // Show kopecks only when they're non-zero — keeps totals tidy for round
  // numbers (1 240 ₴) while still being honest about real values
  // (1 240,55 ₴). Previously `maximumFractionDigits: 0` silently dropped
  // kopecks from every value, so revenue / commission lines lied by a few %.
  const formatCurrency = (n: number) => {
    const hasKopecks = Math.round(n * 100) % 100 !== 0;
    return (
      new Intl.NumberFormat('uk-UA', {
        minimumFractionDigits: hasKopecks ? 2 : 0,
        maximumFractionDigits: 2,
      }).format(n) + ' ₴'
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-12 text-center text-[var(--color-text-secondary)]">
        Немає даних
      </div>
    );
  }

  // Aggregate the daily series into buckets sized by the selected period so
  // we always render ~12-30 bars — readable on any screen. The previous
  // `daily.slice(-30)` silently truncated the 365d view to the last month.
  type Bucket = { label: string; revenue: number; orders: number };
  const aggregateSeries = (
    rows: { day: string; revenue: number; orders: number }[],
    bucket: 'day' | 'week' | 'month',
  ): Bucket[] => {
    if (rows.length === 0) return [];
    if (bucket === 'day') {
      return rows.map((r) => ({
        label: r.day.slice(5), // MM-DD — full year already in the period selector
        revenue: r.revenue,
        orders: r.orders,
      }));
    }
    const out = new Map<string, Bucket>();
    const keyFor = (iso: string): { key: string; label: string } => {
      const d = new Date(iso);
      if (bucket === 'month') {
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        return { key, label: key };
      }
      // ISO-week bucket: anchor each date on Monday of its week.
      const monday = new Date(d);
      const dow = (monday.getUTCDay() + 6) % 7; // 0 = Monday
      monday.setUTCDate(monday.getUTCDate() - dow);
      const key = monday.toISOString().slice(0, 10);
      return { key, label: `тиж. ${key.slice(5)}` };
    };
    for (const r of rows) {
      const { key, label } = keyFor(r.day);
      const existing = out.get(key);
      if (existing) {
        existing.revenue += r.revenue;
        existing.orders += r.orders;
      } else {
        out.set(key, { label, revenue: r.revenue, orders: r.orders });
      }
    }
    return Array.from(out.values());
  };

  const seriesBucket: 'day' | 'week' | 'month' =
    period === '365d' ? 'month' : period === '90d' ? 'week' : 'day';
  const series = aggregateSeries(data.daily, seriesBucket);
  const seriesTitle =
    seriesBucket === 'month'
      ? 'Виручка по місяцях'
      : seriesBucket === 'week'
        ? 'Виручка по тижнях'
        : 'Виручка по днях';
  const maxDaily = Math.max(1, ...series.map((d) => d.revenue));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--color-text-secondary)]">Період:</span>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
        >
          <option value="7d">7 днів</option>
          <option value="30d">30 днів</option>
          <option value="90d">90 днів</option>
          <option value="365d">365 днів</option>
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Замовлень</p>
          <p className="mt-1 flex items-baseline text-2xl font-bold">
            {data.totals.orders}
            <DeltaBadge current={data.totals.orders} previous={data.previousTotals?.orders} />
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Виручка</p>
          <p className="mt-1 flex items-baseline text-2xl font-bold">
            {formatCurrency(data.totals.revenue)}
            <DeltaBadge current={data.totals.revenue} previous={data.previousTotals?.revenue} />
          </p>
        </div>
        <div
          className="rounded-xl border border-green-200 bg-green-50 p-4"
          title="Виручка мінус комісія маркетплейсів. Налаштовується в Settings → «Комісія маркетплейсу, %»."
        >
          <p className="text-xs text-green-800">Прибуток (після комісії)</p>
          <p className="mt-1 text-2xl font-bold text-green-700">
            {formatCurrency(data.totals.netRevenue)}
          </p>
          {data.totals.commission > 0 && (
            <p className="mt-0.5 text-[10px] text-green-700">
              Комісії: −{formatCurrency(data.totals.commission)}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Середній чек</p>
          <p className="mt-1 text-2xl font-bold">{formatCurrency(data.totals.avgOrder)}</p>
        </div>
      </div>

      {data.totals.commission === 0 && data.totals.revenue > 0 && (
        <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          💡 Прибуток показано як виручку, бо комісія маркетплейсів не задана. Вкажіть{' '}
          <strong>«Комісія маркетплейсу, %»</strong> в Налаштуваннях API кожного підключеного
          маркетплейсу для точніших розрахунків.
        </div>
      )}

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <p className="mb-3 text-sm font-semibold">По маркетплейсах</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-secondary)]">
                <th className="px-2 py-2">Маркетплейс</th>
                <th className="px-2 py-2 text-right">Замовлень</th>
                <th className="px-2 py-2 text-right">Виручка</th>
                <th className="px-2 py-2 text-right" title="Комісія цього маркетплейсу за період">
                  Комісія
                </th>
                <th className="px-2 py-2 text-right" title="Виручка мінус комісія">
                  Прибуток
                </th>
                <th className="px-2 py-2 text-right">Сер. чек</th>
                <th className="px-2 py-2 text-right">Опубліковано</th>
              </tr>
            </thead>
            <tbody>
              {data.platforms.map((p) => {
                const meta = MARKETPLACE_BY_KEY[p.platform];
                return (
                  <tr
                    key={p.platform}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2">
                      <span className="mr-1.5">{meta?.icon || '📦'}</span>
                      <span className="font-medium">{meta?.name || p.platform}</span>
                    </td>
                    <td className="px-2 py-2 text-right">{p.orders}</td>
                    <td className="px-2 py-2 text-right">{formatCurrency(p.revenue)}</td>
                    <td className="px-2 py-2 text-right text-[var(--color-text-secondary)]">
                      {p.commissionPercent > 0 ? (
                        <>
                          −{formatCurrency(p.commission)}{' '}
                          <span className="text-[10px]">({p.commissionPercent}%)</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold text-green-700">
                      {formatCurrency(p.netRevenue)}
                    </td>
                    <td className="px-2 py-2 text-right">{formatCurrency(p.avgOrder)}</td>
                    <td className="px-2 py-2 text-right text-[var(--color-text-secondary)]">
                      {p.publishedCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <p className="mb-3 text-sm font-semibold">{seriesTitle}</p>
        {series.length === 0 ? (
          <p className="text-xs text-[var(--color-text-secondary)]">Немає замовлень за період</p>
        ) : (
          <div className="space-y-1">
            {series.map((d) => {
              const pct = (d.revenue / maxDaily) * 100;
              return (
                <div key={d.label} className="flex items-center gap-2 text-xs">
                  <span className="w-20 text-[var(--color-text-secondary)]">{d.label}</span>
                  <div className="flex-1">
                    <div className="h-4 rounded bg-[var(--color-bg-secondary)]">
                      <div
                        className="h-full rounded bg-[var(--color-primary)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-24 text-right font-medium">{formatCurrency(d.revenue)}</span>
                  <span className="w-12 text-right text-[var(--color-text-secondary)]">
                    {d.orders}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {MARKETPLACES.map((m) => {
          const top = data.topProducts[m.key] || [];
          return (
            <div
              key={m.key}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
            >
              <p className="mb-3 text-sm font-semibold">
                {m.icon} Топ-5 {m.name}
              </p>
              {top.length === 0 ? (
                <p className="text-xs text-[var(--color-text-secondary)]">Замовлень не було</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                      <th className="px-2 py-1.5">Товар</th>
                      <th className="px-2 py-1.5 text-right">Кількість</th>
                      <th className="px-2 py-1.5 text-right">Виручка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((p) => (
                      <tr
                        key={p.productCode}
                        className="border-b border-[var(--color-border)] last:border-0"
                      >
                        <td className="px-2 py-1.5">
                          <div className="truncate">{p.productName}</div>
                          <div className="text-[10px] text-[var(--color-text-secondary)]">
                            {p.productCode}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right">{p.quantity}</td>
                        <td className="px-2 py-1.5 text-right">{formatCurrency(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
