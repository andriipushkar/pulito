'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';

interface PriceChange {
  productId: number;
  product: { name: string; code: string } | null;
  priceRetailOld: number;
  priceRetailNew: number;
  changePercent: number;
  changedAt: string;
}

interface PromoImpact {
  productId: number;
  productName: string;
  productCode: string;
  avgSalesBefore: number;
  avgSalesAfter: number;
  salesLift: number;
  revenueBefore: number;
  revenueAfter: number;
}

interface PriceData {
  changes: PriceChange[];
  promoImpact: PromoImpact[];
  summary: {
    totalChanges: number;
    priceIncreases: number;
    priceDecreases: number;
    avgChangePercent: number;
  };
}

export default function PriceAnalytics({ days }: { days: number }) {
  const t = useTranslations('admin.priceAnalytics');
  const [data, setData] = useState<PriceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'changes' | 'promo'>('changes');

  useEffect(() => {
    apiClient
      .get<PriceData>(`/api/v1/admin/analytics/price?days=${days}`)
      .then((res) => {
        if (res.success && res.data) setData(res.data);
      })
      .finally(() => setIsLoading(false));
  }, [days]);

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  if (!data) return null;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div>
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">{t('totalChanges')}</p>
          <p className="text-2xl font-bold">{data.summary.totalChanges}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-green-300 bg-green-50 p-4">
          <p className="text-xs text-green-600">{t('increases')}</p>
          <p className="text-2xl font-bold text-green-700">{data.summary.priceIncreases}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-red-300 bg-red-50 p-4">
          <p className="text-xs text-red-600">{t('decreases')}</p>
          <p className="text-2xl font-bold text-red-700">{data.summary.priceDecreases}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">{t('avgChange')}</p>
          <p className="text-2xl font-bold">{data.summary.avgChangePercent}%</p>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setView('changes')}
          className={`rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium ${view === 'changes' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'}`}
        >
          {t('tabChanges')}
        </button>
        <button
          onClick={() => setView('promo')}
          className={`rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium ${view === 'promo' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'}`}
        >
          {t('tabPromo')}
        </button>
      </div>

      {view === 'changes' && (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-secondary)]">
              <tr>
                <th className="px-4 py-2 text-left">{t('colCode')}</th>
                <th className="px-4 py-2 text-left">{t('colName')}</th>
                <th className="px-4 py-2 text-right">{t('colOldPrice')}</th>
                <th className="px-4 py-2 text-right">{t('colNewPrice')}</th>
                <th className="px-4 py-2 text-right">{t('colChange')}</th>
                <th className="px-4 py-2 text-right">{t('colDate')}</th>
              </tr>
            </thead>
            <tbody>
              {data.changes.map((c, i) => (
                <tr key={i} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-2 text-xs font-mono">{c.product?.code}</td>
                  <td className="px-4 py-2 text-xs">{c.product?.name}</td>
                  <td className="px-4 py-2 text-right text-xs">{c.priceRetailOld.toFixed(2)} ₴</td>
                  <td className="px-4 py-2 text-right text-xs">{c.priceRetailNew.toFixed(2)} ₴</td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        c.changePercent > 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {c.changePercent > 0 ? '+' : ''}
                      {c.changePercent}%
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-[var(--color-text-secondary)]">
                    {formatDate(c.changedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'promo' && (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-secondary)]">
              <tr>
                <th className="px-4 py-2 text-left">{t('colCode')}</th>
                <th className="px-4 py-2 text-left">{t('colName')}</th>
                <th className="px-4 py-2 text-right">{t('colSalesBefore')}</th>
                <th className="px-4 py-2 text-right">{t('colSalesAfter')}</th>
                <th className="px-4 py-2 text-right">{t('colSalesChange')}</th>
                <th className="px-4 py-2 text-right">{t('colRevenueBefore')}</th>
                <th className="px-4 py-2 text-right">{t('colRevenueAfter')}</th>
              </tr>
            </thead>
            <tbody>
              {data.promoImpact.map((p) => (
                <tr key={p.productId} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-2 text-xs font-mono">{p.productCode}</td>
                  <td className="px-4 py-2 text-xs">{p.productName}</td>
                  <td className="px-4 py-2 text-right text-xs">
                    {t('perDay', { count: p.avgSalesBefore })}
                  </td>
                  <td className="px-4 py-2 text-right text-xs">
                    {t('perDay', { count: p.avgSalesAfter })}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        p.salesLift > 0
                          ? 'bg-green-100 text-green-700'
                          : p.salesLift < 0
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {p.salesLift > 0 ? '+' : ''}
                      {p.salesLift}%
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-xs">{p.revenueBefore.toFixed(0)} ₴</td>
                  <td className="px-4 py-2 text-right text-xs">{p.revenueAfter.toFixed(0)} ₴</td>
                </tr>
              ))}
              {data.promoImpact.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-[var(--color-text-secondary)]"
                  >
                    {t('noPromo')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
