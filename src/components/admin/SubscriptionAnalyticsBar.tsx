'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { formatPrice } from '@/utils/format';

interface Analytics {
  counts: { active: number; paused: number; cancelled: number };
  flow30d: { newSubscriptions: number; cancellations: number; churnRatePct: number };
  cancelReasons: { reason: string; count: number }[];
  ltv: { average: number; sampleSize: number };
}

export default function SubscriptionAnalyticsBar() {
  const t = useTranslations('admin.subscriptionAnalyticsBar');
  const reasonLabels: Record<string, string> = {
    user_requested: t('reasonUserRequested'),
    payment_failed: t('reasonPaymentFailed'),
    product_unavailable: t('reasonProductUnavailable'),
    other: t('reasonOther'),
    unknown: t('reasonUnknown'),
  };
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<Analytics>('/api/v1/admin/subscriptions/analytics')
      .then((res) => {
        if (res.success && res.data) setData(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-sm text-[var(--color-text-secondary)]">
        {t('loading')}
      </div>
    );
  }
  if (!data) return null;

  const churnColor =
    data.flow30d.churnRatePct >= 10
      ? 'text-red-600'
      : data.flow30d.churnRatePct >= 5
        ? 'text-amber-600'
        : 'text-emerald-600';

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <p className="text-xs text-[var(--color-text-secondary)]">{t('active')}</p>
        <p className="text-2xl font-bold">{data.counts.active}</p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {t('pausedCancelled', { paused: data.counts.paused, cancelled: data.counts.cancelled })}
        </p>
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <p className="text-xs text-[var(--color-text-secondary)]">{t('over30d')}</p>
        <p className="text-2xl font-bold text-emerald-600">+{data.flow30d.newSubscriptions}</p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {t('cancelledLabel')} <span className="text-red-600">−{data.flow30d.cancellations}</span>
        </p>
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <p className="text-xs text-[var(--color-text-secondary)]">{t('churnTitle')}</p>
        <p className={`text-2xl font-bold ${churnColor}`}>{data.flow30d.churnRatePct}%</p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t('churnHint')}</p>
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <p className="text-xs text-[var(--color-text-secondary)]">{t('avgLtv')}</p>
        <p className="text-2xl font-bold">{formatPrice(data.ltv.average)}</p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {t('amongSubscribers', { count: data.ltv.sampleSize })}
        </p>
      </div>

      {data.cancelReasons.length > 0 && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 sm:col-span-2 lg:col-span-4">
          <p className="mb-2 text-xs font-semibold text-[var(--color-text-secondary)]">
            {t('cancelReasonsTitle')}
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {data.cancelReasons.map((r) => (
              <span
                key={r.reason}
                className="rounded-full border border-[var(--color-border)] px-2 py-1"
              >
                {reasonLabels[r.reason] ?? r.reason}: <strong>{r.count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
