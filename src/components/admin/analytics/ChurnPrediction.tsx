'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';

interface ChurnData {
  atRiskCustomers: { id: number; email: string; fullName: string | null; lastOrderDate: string; daysSinceLastOrder: number; totalOrders: number; totalSpent: number; churnProbability: number }[];
  churnRate: number;
  avgDaysBetweenOrders: number;
  retentionRate: number;
  churnByMonth: { month: string; churned: number; retained: number; rate: number }[];
}

export default function ChurnPrediction({ days }: { days: number }) {
  const [data, setData] = useState<ChurnData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    apiClient
      .get<ChurnData>(`/api/v1/admin/analytics/churn?days=${days}`)
      .then((res) => { if (res.success && res.data) setData(res.data); })
      .finally(() => setIsLoading(false));
  }, [days]);

  if (isLoading) return <div className="flex justify-center py-8"><Spinner size="md" /></div>;
  if (!data) return <p className="text-sm text-[var(--color-text-secondary)]">Дані прогнозу відтоку недоступні</p>;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Рівень відтоку</p>
          <p className={`text-2xl font-bold ${data.churnRate > 20 ? 'text-red-600' : data.churnRate > 10 ? 'text-amber-600' : 'text-green-600'}`}>
            {data.churnRate.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Утримання</p>
          <p className="text-2xl font-bold text-green-600">{data.retentionRate.toFixed(1)}%</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Середній інтервал (днів)</p>
          <p className="text-2xl font-bold">{data.avgDaysBetweenOrders.toFixed(0)}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-4">
          <p className="text-xs text-red-600">Під загрозою відтоку</p>
          <p className="text-2xl font-bold text-red-700">{data.atRiskCustomers.length}</p>
        </div>
      </div>

      {/* Churn by month chart */}
      {data.churnByMonth.length > 0 && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-4 text-sm font-semibold">Відтік по місяцях</h3>
          <div className="flex items-end gap-1" style={{ height: 160 }}>
            {data.churnByMonth.map((m) => {
              const total = m.churned + m.retained;
              const churnPct = total > 0 ? (m.churned / total) * 100 : 0;
              return (
                <div key={m.month} className="group relative flex flex-1 flex-col items-center">
                  <div className="w-full space-y-0.5">
                    <div
                      className="w-full rounded-t bg-red-400"
                      style={{ height: `${(m.churned / Math.max(...data.churnByMonth.map((x) => x.churned + x.retained), 1)) * 120}px`, minHeight: m.churned > 0 ? 2 : 0 }}
                    />
                    <div
                      className="w-full rounded-b bg-green-400"
                      style={{ height: `${(m.retained / Math.max(...data.churnByMonth.map((x) => x.churned + x.retained), 1)) * 120}px`, minHeight: m.retained > 0 ? 2 : 0 }}
                    />
                  </div>
                  <span className="mt-1 text-[9px] text-[var(--color-text-secondary)]">{m.month.slice(5)}</span>
                  <div className="absolute bottom-full mb-1 hidden whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                    {m.month}: {churnPct.toFixed(1)}% відтік
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-red-400" /> Відтік</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-green-400" /> Утримані</span>
          </div>
        </div>
      )}

      {/* At-risk customers table */}
      {data.atRiskCustomers.length > 0 && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">Клієнти під загрозою відтоку</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg-secondary)]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Клієнт</th>
                  <th className="px-3 py-2 text-right font-medium">Останнє замовлення</th>
                  <th className="px-3 py-2 text-right font-medium">Днів без замовлень</th>
                  <th className="px-3 py-2 text-right font-medium">Всього замовлень</th>
                  <th className="px-3 py-2 text-right font-medium">Сума</th>
                  <th className="px-3 py-2 text-right font-medium">Ймовірність відтоку</th>
                </tr>
              </thead>
              <tbody>
                {data.atRiskCustomers.slice(0, 20).map((c) => (
                  <tr key={c.id} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2">
                      <p className="text-xs font-medium">{c.fullName || c.email}</p>
                      {c.fullName && <p className="text-[10px] text-[var(--color-text-secondary)]">{c.email}</p>}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">{new Date(c.lastOrderDate).toLocaleDateString('uk-UA')}</td>
                    <td className="px-3 py-2 text-right text-xs font-medium text-red-600">{c.daysSinceLastOrder}</td>
                    <td className="px-3 py-2 text-right text-xs">{c.totalOrders}</td>
                    <td className="px-3 py-2 text-right text-xs">{c.totalSpent.toFixed(0)} ₴</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.churnProbability > 80 ? 'bg-red-100 text-red-700' :
                        c.churnProbability > 50 ? 'bg-amber-100 text-amber-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {c.churnProbability}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
