'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';

interface Dispute {
  platform: string;
  externalId: string;
  orderExternalId?: string;
  status: 'open' | 'in_review' | 'resolved_buyer' | 'resolved_seller' | 'closed';
  reason?: string;
  amount?: number;
  buyerMessage?: string;
  createdAt: string;
  updatedAt?: string;
  deadlineAt?: string;
}

const STATUS_COLORS: Record<Dispute['status'], string> = {
  open: 'bg-amber-100 text-amber-800',
  in_review: 'bg-blue-100 text-blue-800',
  resolved_buyer: 'bg-red-100 text-red-800',
  resolved_seller: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

const PLATFORM_LABELS: Record<string, string> = {
  olx: '🟢 OLX',
  rozetka: '🟩 Rozetka',
  prom: '🔵 Prom.ua',
  epicentrk: '🟠 Epicentr K',
};

export default function MarketplaceDisputesPage() {
  const t = useTranslations('admin.marketplaceDisputesPage');
  const STATUS_LABELS: Record<Dispute['status'], string> = {
    open: t('statusOpen'),
    in_review: t('statusInReview'),
    resolved_buyer: t('statusResolvedBuyer'),
    resolved_seller: t('statusResolvedSeller'),
    closed: t('statusClosed'),
  };
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .get<{ disputes: Dispute[]; total: number }>('/api/v1/admin/marketplaces/disputes')
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setDisputes(res.data.disputes);
        else toast.error(res.error || t('loadError'));
      })
      .catch(() => {
        if (!cancelled) toast.error(t('networkError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken, t]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  // Items with deadlines in the next 24h get highlighted — these are SLA risks.
  // Freeze `now` per disputes change to keep this computation pure during render.
  const urgentSet = useMemo(() => {
    const now = Date.now();
    const set = new Set<string>();
    for (const d of disputes) {
      if (!d.deadlineAt) continue;
      const ms = new Date(d.deadlineAt).getTime() - now;
      if (ms > 0 && ms < 24 * 60 * 60 * 1000) set.add(`${d.platform}:${d.externalId}`);
    }
    return set;
  }, [disputes]);
  const isUrgent = (d: Dispute): boolean => urgentSet.has(`${d.platform}:${d.externalId}`);

  const openCount = disputes.filter((d) => d.status === 'open' || d.status === 'in_review').length;
  const urgentCount = urgentSet.size;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('intro')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {t('stats', { total: disputes.length })}
            <strong>{openCount}</strong>
            {urgentCount > 0 && (
              <>
                {' · '}
                <span className="text-red-600">{t('urgentBadge', { count: urgentCount })}</span>
              </>
            )}
          </span>
          <Button size="sm" variant="outline" onClick={refresh}>
            {t('refresh')}
          </Button>
        </div>
      </div>

      {loading ? (
        <AdminTableSkeleton rows={5} columns={7} />
      ) : disputes.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-12 text-center text-[var(--color-text-secondary)]">
          <p className="text-lg">{t('empty')}</p>
          <p className="mt-1 text-sm">{t('emptyHint')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('colMarketplace')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('colId')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('colOrder')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('colReason')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('colStatus')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  {t('colAmount')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('colDeadline')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {disputes.map((d) => (
                <tr
                  key={`${d.platform}-${d.externalId}`}
                  className={isUrgent(d) ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {PLATFORM_LABELS[d.platform] || d.platform}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{d.externalId}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {d.orderExternalId || '—'}
                  </td>
                  <td
                    className="max-w-[280px] truncate px-4 py-3 text-sm"
                    title={d.reason || d.buyerMessage || ''}
                  >
                    {d.reason || d.buyerMessage || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[d.status]}`}
                    >
                      {STATUS_LABELS[d.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    {d.amount != null ? `${d.amount.toFixed(2)} грн` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {d.deadlineAt ? (
                      <span className={isUrgent(d) ? 'font-semibold text-red-600' : ''}>
                        {formatDate(d.deadlineAt)}
                      </span>
                    ) : (
                      '—'
                    )}
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
