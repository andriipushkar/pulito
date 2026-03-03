'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';

interface StockItem {
  id: number;
  code: string;
  name: string;
  quantity: number;
}

interface CriticalStock extends StockItem {
  avgDailySales: number;
  daysUntilOut: number | null;
}

interface DeadStock extends StockItem {
  lastSoldAt: string | null;
  daysSinceLastSale: number | null;
}

interface TurnoverItem extends StockItem {
  soldLast30: number;
  turnoverRate: number;
}

interface StockData {
  criticalStock: CriticalStock[];
  deadStock: DeadStock[];
  turnoverRates: TurnoverItem[];
  summary: { totalProducts: number; criticalCount: number; deadStockCount: number; avgTurnover: number };
}

export default function StockAnalytics({ days }: { days: number }) {
  const [data, setData] = useState<StockData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'critical' | 'dead' | 'turnover'>('critical');

  useEffect(() => {
    apiClient.get<StockData>(`/api/v1/admin/analytics/stock?days=${days}`)
      .then((res) => { if (res.success && res.data) setData(res.data); })
      .finally(() => setIsLoading(false));
  }, [days]);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  if (!data) return null;

  return (
    <div>
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Активних товарів</p>
          <p className="text-2xl font-bold">{data.summary.totalProducts}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-red-300 bg-red-50 p-4">
          <p className="text-xs text-red-600">Критичний запас</p>
          <p className="text-2xl font-bold text-red-700">{data.summary.criticalCount}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-orange-300 bg-orange-50 p-4">
          <p className="text-xs text-orange-600">Dead stock (60+ днів)</p>
          <p className="text-2xl font-bold text-orange-700">{data.summary.deadStockCount}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Сер. оборотність</p>
          <p className="text-2xl font-bold">{data.summary.avgTurnover}</p>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {(['critical', 'dead', 'turnover'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium ${view === v ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'}`}
          >
            {v === 'critical' ? 'Критичні залишки' : v === 'dead' ? 'Dead Stock' : 'Оборотність'}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              <th className="px-4 py-2 text-left">Код</th>
              <th className="px-4 py-2 text-left">Назва</th>
              <th className="px-4 py-2 text-right">Залишок</th>
              {view === 'critical' && (
                <>
                  <th className="px-4 py-2 text-right">Продаж/день</th>
                  <th className="px-4 py-2 text-right">Днів до 0</th>
                </>
              )}
              {view === 'dead' && (
                <th className="px-4 py-2 text-right">Днів без продажу</th>
              )}
              {view === 'turnover' && (
                <>
                  <th className="px-4 py-2 text-right">Продано</th>
                  <th className="px-4 py-2 text-right">Оборотність</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {view === 'critical' && data.criticalStock.map((item) => (
              <tr key={item.id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2 text-xs font-mono">{item.code}</td>
                <td className="px-4 py-2 text-xs">{item.name}</td>
                <td className="px-4 py-2 text-right text-xs">{item.quantity}</td>
                <td className="px-4 py-2 text-right text-xs">{item.avgDailySales}</td>
                <td className="px-4 py-2 text-right">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    (item.daysUntilOut ?? 999) <= 3 ? 'bg-red-100 text-red-700' :
                    (item.daysUntilOut ?? 999) <= 7 ? 'bg-orange-100 text-orange-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {item.daysUntilOut ?? '—'} дн.
                  </span>
                </td>
              </tr>
            ))}
            {view === 'dead' && data.deadStock.map((item) => (
              <tr key={item.id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2 text-xs font-mono">{item.code}</td>
                <td className="px-4 py-2 text-xs">{item.name}</td>
                <td className="px-4 py-2 text-right text-xs">{item.quantity}</td>
                <td className="px-4 py-2 text-right">
                  <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700">
                    {item.daysSinceLastSale ?? 'Ніколи'}
                  </span>
                </td>
              </tr>
            ))}
            {view === 'turnover' && data.turnoverRates.map((item) => (
              <tr key={item.id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2 text-xs font-mono">{item.code}</td>
                <td className="px-4 py-2 text-xs">{item.name}</td>
                <td className="px-4 py-2 text-right text-xs">{item.quantity}</td>
                <td className="px-4 py-2 text-right text-xs">{item.soldLast30}</td>
                <td className="px-4 py-2 text-right">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    item.turnoverRate >= 1 ? 'bg-green-100 text-green-700' :
                    item.turnoverRate >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {item.turnoverRate}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
