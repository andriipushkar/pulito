'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';

interface SourceRow { source: string; orders: number; revenue: number }
interface UtmRow { utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null; orders: number; revenue: number }
interface ConversionRow { source: string; visits: number; conversions: number; conversionRate: number }

interface ChannelData {
  bySource: SourceRow[];
  byUtmSource: UtmRow[];
  byUtmMedium: UtmRow[];
  byUtmCampaign: UtmRow[];
  channelConversionRates: ConversionRow[];
}

const SOURCE_LABELS: Record<string, string> = {
  web: 'Сайт',
  telegram_bot: 'Telegram бот',
  viber_bot: 'Viber бот',
};

export default function ChannelAnalytics({ days }: { days: number }) {
  const [data, setData] = useState<ChannelData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'source' | 'utm_source' | 'utm_medium' | 'utm_campaign' | 'conversion'>('source');

  useEffect(() => {
    apiClient.get<ChannelData>(`/api/v1/admin/analytics/channels?days=${days}`)
      .then((res) => { if (res.success && res.data) setData(res.data); })
      .finally(() => setIsLoading(false));
  }, [days]);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  if (!data) return null;

  const totalRevenue = data.bySource.reduce((s, r) => s + r.revenue, 0);
  const totalOrders = data.bySource.reduce((s, r) => s + r.orders, 0);

  const views: { key: typeof view; label: string }[] = [
    { key: 'source', label: 'Джерело' },
    { key: 'utm_source', label: 'UTM Source' },
    { key: 'utm_medium', label: 'UTM Medium' },
    { key: 'utm_campaign', label: 'UTM Campaign' },
    { key: 'conversion', label: 'Конверсія' },
  ];

  return (
    <div>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Замовлень</p>
          <p className="text-2xl font-bold">{totalOrders}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Виручка</p>
          <p className="text-2xl font-bold">{totalRevenue.toFixed(0)} ₴</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Каналів конверсії</p>
          <p className="text-2xl font-bold">{data.channelConversionRates.length}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium ${view === v.key ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'source' && (
        <div className="space-y-3">
          {data.bySource.map((row) => {
            const pct = totalOrders > 0 ? (row.orders / totalOrders) * 100 : 0;
            return (
              <div key={row.source} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{SOURCE_LABELS[row.source] || row.source}</span>
                  <span className="text-sm font-bold">{row.orders} зам. / {row.revenue.toFixed(0)} ₴</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
                  <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{pct.toFixed(1)}% замовлень</p>
              </div>
            );
          })}
        </div>
      )}

      {(view === 'utm_source' || view === 'utm_medium' || view === 'utm_campaign') && (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-secondary)]">
              <tr>
                <th className="px-4 py-2 text-left">
                  {view === 'utm_source' ? 'UTM Source' : view === 'utm_medium' ? 'UTM Medium' : 'UTM Campaign'}
                </th>
                <th className="px-4 py-2 text-right">Замовлень</th>
                <th className="px-4 py-2 text-right">Виручка</th>
                <th className="px-4 py-2 text-right">Сер. чек</th>
              </tr>
            </thead>
            <tbody>
              {(view === 'utm_source' ? data.byUtmSource : view === 'utm_medium' ? data.byUtmMedium : data.byUtmCampaign).map((row, i) => {
                const label = view === 'utm_source' ? row.utmSource : view === 'utm_medium' ? row.utmMedium : row.utmCampaign;
                return (
                  <tr key={i} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-2 text-xs font-medium">{label || 'Без мітки'}</td>
                    <td className="px-4 py-2 text-right text-xs">{row.orders}</td>
                    <td className="px-4 py-2 text-right text-xs">{row.revenue.toFixed(0)} ₴</td>
                    <td className="px-4 py-2 text-right text-xs">{row.orders > 0 ? (row.revenue / row.orders).toFixed(0) : 0} ₴</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === 'conversion' && (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-secondary)]">
              <tr>
                <th className="px-4 py-2 text-left">Канал</th>
                <th className="px-4 py-2 text-right">Візити</th>
                <th className="px-4 py-2 text-right">Конверсії</th>
                <th className="px-4 py-2 text-right">Конверсія %</th>
              </tr>
            </thead>
            <tbody>
              {data.channelConversionRates.map((row) => (
                <tr key={row.source} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-2 text-xs font-medium">{row.source}</td>
                  <td className="px-4 py-2 text-right text-xs">{row.visits}</td>
                  <td className="px-4 py-2 text-right text-xs">{row.conversions}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      row.conversionRate >= 3 ? 'bg-green-100 text-green-700' :
                      row.conversionRate >= 1 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {row.conversionRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
