'use client';

import { useTranslations } from 'next-intl';
import { type OrderDetail } from '@/types/order';

interface OrderTimelineProps {
  order: OrderDetail;
}

interface TimelineEvent {
  ts: Date;
  icon: string;
  iconBg: string;
  title: string;
  detail?: string;
  source?: string;
}

// Maps a status-history changeSource to its label key in admin.orderTimeline.
const SOURCE_KEY: Record<string, string> = {
  manager: 'source_manager',
  client_action: 'source_client',
  system: 'source_system',
  cron: 'source_cron',
};

function formatTs(d: Date | string): string {
  const date = new Date(d);
  return date.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * OrderTimeline — vertical chronological feed combining status changes,
 * payment events, TTN assignment, manager comments, and order creation.
 *
 * Replaces the old "Історія змін" block that only listed status transitions.
 * Each event has a colored icon so the eye can scan it; events render newest
 * first to match the rest of the page (manager focuses on what changed last).
 */
export default function OrderTimeline({ order }: OrderTimelineProps) {
  const t = useTranslations('admin.orderTimeline');
  const tl = useTranslations('orderLabels');
  const statusLabel = (s: string) => (tl.has(`status.${s}`) ? tl(`status.${s}`) : s);
  const events: TimelineEvent[] = [];

  // Order creation — always the first (oldest) event.
  events.push({
    ts: new Date(order.createdAt),
    icon: '🛒',
    iconBg: 'bg-blue-500',
    title: t('created'),
    detail: t('itemsSummary', {
      count: order.itemsCount ?? order.items.length,
      amount: Number(order.totalAmount).toFixed(2),
    }),
  });

  // Status changes
  for (const h of order.statusHistory) {
    const title = h.oldStatus
      ? `${statusLabel(h.oldStatus)} → ${statusLabel(h.newStatus)}`
      : t('statusPrefix', { status: statusLabel(h.newStatus) });
    events.push({
      ts: new Date(h.createdAt),
      icon: '🔄',
      iconBg: 'bg-violet-500',
      title,
      detail: h.comment || undefined,
      source: SOURCE_KEY[h.changeSource] ? t(SOURCE_KEY[h.changeSource]) : h.changeSource,
    });
  }

  // Payment paid
  if (order.payment?.paidAt) {
    events.push({
      ts: new Date(order.payment.paidAt),
      icon: '💳',
      iconBg: 'bg-emerald-500',
      title: t('paymentReceived'),
      detail: order.payment.paymentProvider
        ? t('paymentProvider', { provider: order.payment.paymentProvider }) +
          (order.payment.transactionId ? t('txnSuffix', { txn: order.payment.transactionId }) : '')
        : undefined,
    });
  }

  // TTN assigned — we don't have a separate timestamp; tie to the shipped
  // status entry when present, otherwise to order creation.
  if (order.trackingNumber) {
    const shippedEntry = order.statusHistory.find((h) => h.newStatus === 'shipped');
    events.push({
      ts: shippedEntry ? new Date(shippedEntry.createdAt) : new Date(order.createdAt),
      icon: '📦',
      iconBg: 'bg-amber-500',
      title: t('ttnAssigned', { ttn: order.trackingNumber }),
    });
  }

  // Manager comment — bucketed at the latest status-change time (best proxy
  // for "most recent admin action" since OrderDetail doesn't expose updatedAt).
  if (order.managerComment) {
    const latestStatus = order.statusHistory[0]; // sorted desc by API
    events.push({
      ts: latestStatus ? new Date(latestStatus.createdAt) : new Date(order.createdAt),
      icon: '💬',
      iconBg: 'bg-sky-500',
      title: t('managerComment'),
      detail: order.managerComment,
    });
  }

  // Sort newest first (matches the rest of the admin UI).
  events.sort((a, b) => b.ts.getTime() - a.ts.getTime());

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-sm font-semibold uppercase text-[var(--color-text-secondary)]">
        {t('activity', { count: events.length })}
      </h3>
      <ol className="relative space-y-3 border-l-2 border-[var(--color-border)] pl-5">
        {events.map((e, i) => (
          <li key={i} className="relative">
            <span
              className={`absolute -left-[28px] flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white ${e.iconBg}`}
              aria-hidden
            >
              {e.icon}
            </span>
            <div className="text-sm">
              <span className="font-medium">{e.title}</span>
              <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                {formatTs(e.ts)}
              </span>
              {e.source && (
                <span className="ml-1 text-[10px] text-[var(--color-text-secondary)]">
                  ({e.source})
                </span>
              )}
              {e.detail && (
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{e.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
