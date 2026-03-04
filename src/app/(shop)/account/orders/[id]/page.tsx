'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  DELIVERY_METHOD_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/types/order';
import type { OrderDetail, OrderStatus } from '@/types/order';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import PrintableOrder from '@/components/order/PrintableOrder';

/* ── Icons (inline SVGs) ── */
const IconUser = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const IconTruck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
);
const IconCreditCard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
);
const IconPackage = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
);
const IconClock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    apiClient
      .get<OrderDetail>(`/api/v1/orders/${id}`)
      .then((res) => {
        if (res.success && res.data) {
          setOrder(res.data);
        }
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleCancel = async () => {
    if (!confirm('Ви впевнені, що хочете скасувати це замовлення?')) return;
    setIsCancelling(true);
    try {
      const res = await apiClient.put(`/api/v1/orders/${id}/status`, { status: 'cancelled' });
      if (res.success) {
        setOrder((prev) => prev ? { ...prev, status: 'cancelled' as OrderStatus } : prev);
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const formatDateTime = (date: string | Date) =>
    new Date(date).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-orange-400">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
          </svg>
        </div>
        <p className="text-[var(--color-text-secondary)]">Замовлення не знайдено</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/account/orders')}>
          Повернутись до замовлень
        </Button>
      </div>
    );
  }

  const canCancel = order.status === 'new_order' || order.status === 'processing';
  const total = Number(order.totalAmount);
  const discount = Number(order.discountAmount);
  const delivery = Number(order.deliveryCost);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Головна', href: '/' },
          { label: 'Замовлення', href: '/account/orders' },
          { label: `#${order.orderNumber}` },
        ]}
        className="mb-6"
      />

      {/* ── Header ── */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">#{order.orderNumber}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{formatDate(order.createdAt)}</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <span
              className="rounded-full px-4 py-1.5 text-sm font-semibold"
              style={{ backgroundColor: ORDER_STATUS_COLORS[order.status] + '18', color: ORDER_STATUS_COLORS[order.status] }}
            >
              {ORDER_STATUS_LABELS[order.status]}
            </span>
            <p className="text-2xl font-bold">{total.toFixed(2)} <span className="text-lg">₴</span></p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-5 flex flex-wrap gap-3 border-t border-[var(--color-border)]/60 pt-5">
          <PrintableOrder order={order} />
          {canCancel && (
            <Button variant="danger" size="sm" onClick={handleCancel} isLoading={isCancelling}>
              Скасувати замовлення
            </Button>
          )}
        </div>
      </div>

      {/* ── Info (two-column layout) ── */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)]">
        <div className="grid sm:grid-cols-[1fr_auto_1fr]">
          {/* Left column: Contact + Delivery */}
          <div>
            <div className="p-5">
              <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Контактна особа</h3>
              <p className="text-sm font-semibold">{order.contactName}</p>
              <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{order.contactPhone}</p>
              {order.contactEmail && (
                <p className="text-sm text-[var(--color-text-secondary)]">{order.contactEmail}</p>
              )}
            </div>
            <div className="border-t border-[var(--color-border)]/40 p-5">
              <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Доставка</h3>
              <p className="text-sm font-semibold">{DELIVERY_METHOD_LABELS[order.deliveryMethod]}</p>
              {(order.deliveryCity || order.deliveryAddress) && (
                <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
                  {[order.deliveryCity, order.deliveryAddress].filter(Boolean).join(', ')}
                </p>
              )}
              {order.trackingNumber && (
                <p className="mt-2 font-mono text-base font-bold tracking-wide text-[var(--color-primary)]">
                  ТТН: {order.trackingNumber}
                </p>
              )}
            </div>
            {order.comment && (
              <div className="border-t border-[var(--color-border)]/40 p-5">
                <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Коментар</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">{order.comment}</p>
              </div>
            )}
          </div>

          {/* Vertical divider */}
          <div className="hidden border-l border-[var(--color-border)]/60 sm:block" />
          {/* Mobile horizontal divider */}
          <div className="border-t border-[var(--color-border)]/60 sm:hidden" style={{ gridColumn: '1 / -1' }} />

          {/* Right column: Payment + Totals */}
          <div>
            <div className="p-5">
              <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Оплата</h3>
              <p className="text-sm font-semibold">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
              <p className="mt-1.5">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  order.paymentStatus === 'paid'
                    ? 'bg-green-100 text-green-700'
                    : order.paymentStatus === 'refunded'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                }`}>
                  {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                </span>
              </p>
            </div>
            <div className="border-t border-[var(--color-border)]/40 p-5">
              <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Сума замовлення</h3>
              <div className="space-y-1.5 text-sm">
                {discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Знижка</span>
                    <span className="font-medium text-green-600">-{discount.toFixed(2)} ₴</span>
                  </div>
                )}
                {delivery > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Доставка</span>
                    <span>{delivery.toFixed(2)} ₴</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between pt-1">
                  <span className="font-bold">Разом</span>
                  <span className="text-xl font-bold">{total.toFixed(2)} ₴</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Items ── */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
            <IconPackage />
          </div>
          <h3 className="text-sm font-bold">Товари ({order.items.length})</h3>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]/60">
          {/* Table header */}
          <div className="hidden border-b border-[var(--color-border)]/60 bg-[var(--color-bg-secondary)] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] sm:grid sm:grid-cols-[1fr_auto_auto_auto]">
            <span>Товар</span>
            <span className="w-20 text-right">Ціна</span>
            <span className="w-14 text-center">К-ть</span>
            <span className="w-24 text-right">Сума</span>
          </div>
          {order.items.map((item, i) => (
            <div
              key={item.productId}
              className={`flex gap-4 p-4 sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:items-center ${
                i < order.items.length - 1 ? 'border-b border-[var(--color-border)]/60' : ''
              } ${i % 2 === 1 ? 'bg-[var(--color-bg-secondary)]/30' : ''}`}
            >
              {/* Product info */}
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[var(--color-bg-secondary)]">
                  {item.imagePath ? (
                    <Image src={item.imagePath} alt={item.productName} fill className="object-cover" sizes="56px" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
                      <IconPackage />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.productName}</p>
                  <p className="font-mono text-xs text-[var(--color-text-secondary)]">{item.productCode}</p>
                </div>
              </div>
              {/* Price */}
              <div className="w-20 text-right text-sm text-[var(--color-text-secondary)]">
                {Number(item.priceAtOrder).toFixed(2)} ₴
              </div>
              {/* Qty */}
              <div className="w-14 text-center">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-sm font-medium">
                  {item.quantity}
                </span>
              </div>
              {/* Subtotal */}
              <div className="w-24 text-right text-sm font-bold">
                {Number(item.subtotal).toFixed(2)} ₴
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Status history ── */}
      {order.statusHistory.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
              <IconClock />
            </div>
            <h3 className="text-sm font-bold">Історія замовлення</h3>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]/60 p-5">
            <div className="relative space-y-0">
              {order.statusHistory.map((entry, i) => (
                <div key={entry.id} className="relative flex gap-4 pb-4 last:pb-0">
                  {/* Timeline line */}
                  {i < order.statusHistory.length - 1 && (
                    <div className="absolute left-[11px] top-7 h-full w-0.5 bg-gradient-to-b from-[var(--color-primary)] to-[var(--color-border)]" />
                  )}
                  {/* Dot */}
                  <div className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-primary)] bg-[var(--color-bg)] shadow-sm">
                    <div className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
                  </div>
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {entry.oldStatus
                        ? <>{ORDER_STATUS_LABELS[entry.oldStatus as OrderStatus]} <span className="text-[var(--color-text-secondary)]">&rarr;</span> {ORDER_STATUS_LABELS[entry.newStatus as OrderStatus]}</>
                        : ORDER_STATUS_LABELS[entry.newStatus as OrderStatus]}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {formatDateTime(entry.createdAt)}
                      {entry.comment && <span className="ml-1">&mdash; {entry.comment}</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Back link */}
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/5"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Повернутись до замовлень
      </Link>
    </div>
  );
}
