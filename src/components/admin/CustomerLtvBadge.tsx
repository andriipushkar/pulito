'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { formatPrice } from '@/utils/format';

export interface CustomerHistory {
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string | Date | null;
  lastOrderNumber: string | null;
  lastOrderId: number | null;
}

interface CustomerLtvBadgeProps {
  orderId: number;
  /**
   * Optional pre-loaded history. When provided, this component skips its own
   * fetch. The order-details page already loads this endpoint at the top of
   * the page — passing it through here saves a duplicate request.
   */
  history?: CustomerHistory | null;
}

/**
 * Shows aggregate stats for the customer of the current order — number of
 * prior orders, total spent, last order link. Hidden when this is the first
 * order (totalOrders === 0) so it doesn't clutter the UI.
 */
export default function CustomerLtvBadge({ orderId, history: pre }: CustomerLtvBadgeProps) {
  const t = useTranslations('admin.customerLtvBadge');
  const [history, setHistory] = useState<CustomerHistory | null>(pre ?? null);

  useEffect(() => {
    if (pre !== undefined) {
      // Parent owns the data — just sync our local copy when it changes.
      setHistory(pre);
      return;
    }
    let cancelled = false;
    apiClient
      .get<CustomerHistory>(`/api/v1/admin/orders/${orderId}/customer-history`)
      .then((res) => {
        if (!cancelled && res.success && res.data) setHistory(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orderId, pre]);

  if (!history || history.totalOrders === 0) {
    // First-time customer: show a subtle hint instead of nothing — useful
    // signal too (manager knows to give a great first impression).
    if (history && history.totalOrders === 0) {
      return (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
          {t('firstOrder')}
        </div>
      );
    }
    return null;
  }

  const lastDateStr = history.lastOrderDate
    ? new Date(history.lastOrderDate).toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // Highlight VIPs (3+ orders OR 5000₴+ spent) in gold; regular returning
  // customers get a friendly green badge.
  const isVip = history.totalOrders >= 3 || history.totalSpent >= 5000;
  const colorClass = isVip
    ? 'bg-amber-50 text-amber-800 border-amber-200'
    : 'bg-emerald-50 text-emerald-800 border-emerald-200';

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${colorClass}`}
    >
      <span className="font-semibold">
        {isVip ? '⭐ VIP' : '🔁'} {t('returningCustomer')}
      </span>
      <span>
        <strong>{history.totalOrders}</strong> {t('prior')} · {t('inTotal')}{' '}
        <strong>{formatPrice(history.totalSpent)}</strong>
      </span>
      {history.lastOrderId && history.lastOrderNumber && lastDateStr && (
        <Link
          href={`/admin/orders/${history.lastOrderId}`}
          className="ml-1 underline decoration-dotted hover:opacity-70"
        >
          {t('lastOrder', { number: history.lastOrderNumber, date: lastDateStr })}
        </Link>
      )}
    </div>
  );
}
