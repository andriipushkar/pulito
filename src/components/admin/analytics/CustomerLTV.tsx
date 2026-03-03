'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';

interface LTVCustomer {
  userId: number;
  email: string;
  fullName: string;
  companyName: string | null;
  totalSpent: number;
  orderCount: number;
  avgCheck: number;
  firstOrderAt: string;
  lastOrderAt: string;
  lifetimeDays: number;
  monthlyValue: number;
  projectedYearlyLTV: number;
}

interface DistBucket {
  label: string;
  count: number;
  revenue: number;
}

interface LTVData {
  topCustomers: LTVCustomer[];
  summary: { totalCustomers: number; totalRevenue: number; avgLTV: number; medianLTV: number };
  distribution: DistBucket[];
}

export default function CustomerLTV({ days }: { days: number }) {
  const [data, setData] = useState<LTVData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient.get<LTVData>(`/api/v1/admin/analytics/ltv?days=${days}`)
      .then((res) => { if (res.success && res.data) setData(res.data); })
      .finally(() => setIsLoading(false));
  }, [days]);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  if (!data) return null;

  const maxBucket = Math.max(...data.distribution.map((d) => d.count), 1);
  const formatDate = (d: string) => new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div>
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Клієнтів</p>
          <p className="text-2xl font-bold">{data.summary.totalCustomers}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Загальна виручка</p>
          <p className="text-2xl font-bold">{data.summary.totalRevenue.toFixed(0)} ₴</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Середній LTV</p>
          <p className="text-2xl font-bold">{data.summary.avgLTV.toFixed(0)} ₴</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Медіана LTV</p>
          <p className="text-2xl font-bold">{data.summary.medianLTV.toFixed(0)} ₴</p>
        </div>
      </div>

      {/* Distribution chart */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-4 text-sm font-semibold">Розподіл LTV</h3>
        <div className="flex items-end gap-4" style={{ height: 160 }}>
          {data.distribution.map((bucket) => (
            <div key={bucket.label} className="flex flex-1 flex-col items-center">
              <span className="mb-1 text-xs font-bold">{bucket.count}</span>
              <div
                className="w-full rounded-t bg-[var(--color-primary)]"
                style={{ height: `${(bucket.count / maxBucket) * 100}%`, minHeight: bucket.count > 0 ? 4 : 0 }}
              />
              <span className="mt-2 text-center text-[10px] text-[var(--color-text-secondary)]">{bucket.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top customers table */}
      <h3 className="mb-3 text-sm font-semibold">Топ-50 клієнтів за LTV</h3>
      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Клієнт</th>
              <th className="px-3 py-2 text-right">Витрачено</th>
              <th className="px-3 py-2 text-right">Замовл.</th>
              <th className="px-3 py-2 text-right">Сер. чек</th>
              <th className="px-3 py-2 text-right">Міс. вартість</th>
              <th className="px-3 py-2 text-right">Річний LTV</th>
              <th className="px-3 py-2 text-right">Перше зам.</th>
              <th className="px-3 py-2 text-right">Останнє</th>
            </tr>
          </thead>
          <tbody>
            {data.topCustomers.map((c, i) => (
              <tr key={c.userId} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">{i + 1}</td>
                <td className="px-3 py-2">
                  <p className="text-xs font-medium">{c.fullName || c.email}</p>
                  {c.companyName && <p className="text-[10px] text-[var(--color-text-secondary)]">{c.companyName}</p>}
                </td>
                <td className="px-3 py-2 text-right text-xs font-bold">{c.totalSpent.toFixed(0)} ₴</td>
                <td className="px-3 py-2 text-right text-xs">{c.orderCount}</td>
                <td className="px-3 py-2 text-right text-xs">{c.avgCheck} ₴</td>
                <td className="px-3 py-2 text-right text-xs">{c.monthlyValue} ₴</td>
                <td className="px-3 py-2 text-right">
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                    {c.projectedYearlyLTV.toFixed(0)} ₴
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-[10px] text-[var(--color-text-secondary)]">{formatDate(c.firstOrderAt)}</td>
                <td className="px-3 py-2 text-right text-[10px] text-[var(--color-text-secondary)]">{formatDate(c.lastOrderAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
