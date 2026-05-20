'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import { MARKETPLACES } from '../_shared';

interface PlatformStats {
  platform: string;
  orders: number;
  revenue: number;
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
  totals: { orders: number; revenue: number; avgOrder: number };
  platforms: PlatformStats[];
  topProducts: Record<string, TopProduct[]>;
  daily: { day: string; revenue: number; orders: number }[];
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

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(n) + ' ₴';

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

  const maxDaily = Math.max(1, ...data.daily.map((d) => d.revenue));

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

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Замовлень</p>
          <p className="mt-1 text-2xl font-bold">{data.totals.orders}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Виручка</p>
          <p className="mt-1 text-2xl font-bold">{formatCurrency(data.totals.revenue)}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Середній чек</p>
          <p className="mt-1 text-2xl font-bold">{formatCurrency(data.totals.avgOrder)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <p className="mb-3 text-sm font-semibold">По маркетплейсах</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-secondary)]">
                <th className="px-2 py-2">Маркетплейс</th>
                <th className="px-2 py-2 text-right">Замовлень</th>
                <th className="px-2 py-2 text-right">Виручка</th>
                <th className="px-2 py-2 text-right">Сер. чек</th>
                <th className="px-2 py-2 text-right">Опубліковано</th>
              </tr>
            </thead>
            <tbody>
              {data.platforms.map((p) => {
                const meta = MARKETPLACES.find((m) => m.key === p.platform);
                return (
                  <tr key={p.platform} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-2 py-2">
                      <span className="mr-1.5">{meta?.icon || '📦'}</span>
                      <span className="font-medium">{meta?.name || p.platform}</span>
                    </td>
                    <td className="px-2 py-2 text-right">{p.orders}</td>
                    <td className="px-2 py-2 text-right">{formatCurrency(p.revenue)}</td>
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
        <p className="mb-3 text-sm font-semibold">Виручка по днях</p>
        {data.daily.length === 0 ? (
          <p className="text-xs text-[var(--color-text-secondary)]">Немає замовлень за період</p>
        ) : (
          <div className="space-y-1">
            {data.daily.slice(-30).map((d) => {
              const pct = (d.revenue / maxDaily) * 100;
              return (
                <div key={d.day} className="flex items-center gap-2 text-xs">
                  <span className="w-20 text-[var(--color-text-secondary)]">{d.day}</span>
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
