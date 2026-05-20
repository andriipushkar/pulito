'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  DELIVERY_METHOD_LABELS,
} from '@/types/order';
import type { OrderStatus, DeliveryMethod } from '@/types/order';

interface TrackedOrder {
  orderNumber: string;
  status: OrderStatus;
  totalAmount: string | number;
  itemsCount: string | number;
  deliveryMethod: DeliveryMethod;
  deliveryCity: string | null;
  deliveryAddress: string | null;
  trackingNumber: string | null;
  trackingStatus: string | null;
  trackingStatusAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: {
    id: number;
    productName: string;
    productCode: string;
    quantity: number;
    priceAtOrder: string | number;
    subtotal: string | number;
  }[];
  statusHistory: {
    id: number;
    newStatus: string;
    createdAt: string;
    comment: string | null;
  }[];
}

const REFRESH_INTERVAL_MS = 60_000;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrderTrackPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = use(params);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchOrder = async () => {
      try {
        const res = await apiClient.get<TrackedOrder>(`/api/v1/track/${orderNumber}`);
        if (cancelled) return;
        if (res.success && res.data) {
          setOrder(res.data);
          setError(null);
        } else {
          setError(res.error || 'Замовлення не знайдено');
        }
      } catch {
        if (!cancelled) setError('Помилка завантаження');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchOrder();
    const interval = setInterval(fetchOrder, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orderNumber]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="mb-2 text-xl font-bold">Замовлення не знайдено</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {error ?? 'Перевірте номер замовлення у листі-підтвердженні.'}
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm text-[var(--color-primary)] hover:underline"
        >
          На головну
        </Link>
      </div>
    );
  }

  const trackingUrl =
    order.trackingNumber && order.deliveryMethod === 'nova_poshta'
      ? `https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(order.trackingNumber)}`
      : order.trackingNumber && order.deliveryMethod === 'ukrposhta'
        ? `https://track.ukrposhta.ua/tracking_UA.html?barcode=${encodeURIComponent(order.trackingNumber)}`
        : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
          Замовлення
        </p>
        <h1 className="mb-3 text-2xl font-bold tabular-nums">#{order.orderNumber}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-block rounded-full px-3 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: ORDER_STATUS_COLORS[order.status] }}
          >
            {ORDER_STATUS_LABELS[order.status]}
          </span>
          <span className="text-sm text-[var(--color-text-secondary)]">
            Створено {formatDateTime(order.createdAt)}
          </span>
        </div>
      </div>

      {/* Tracking */}
      {order.trackingNumber ? (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Доставка
          </h2>
          <p className="text-sm">
            <strong>{DELIVERY_METHOD_LABELS[order.deliveryMethod]}</strong>
            {order.deliveryCity && ` · ${order.deliveryCity}`}
          </p>
          {order.deliveryAddress && (
            <p className="text-sm text-[var(--color-text-secondary)]">{order.deliveryAddress}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="rounded-md bg-[var(--color-bg-secondary)] px-3 py-1.5 font-mono text-sm tabular-nums">
              ТТН: {order.trackingNumber}
            </span>
            {trackingUrl && (
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[var(--color-primary)] hover:underline"
              >
                Відкрити сторінку перевізника →
              </a>
            )}
          </div>
          {order.trackingStatus && (
            <p className="mt-3 text-sm">
              <span className="text-[var(--color-text-secondary)]">Статус ТТН:</span>{' '}
              <strong>{order.trackingStatus}</strong>
              {order.trackingStatusAt && (
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {' '}
                  · оновлено {formatDateTime(order.trackingStatusAt)}
                </span>
              )}
            </p>
          )}
        </div>
      ) : (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Доставка
          </h2>
          <p className="text-sm">
            {DELIVERY_METHOD_LABELS[order.deliveryMethod]}
            {order.deliveryCity && ` · ${order.deliveryCity}`}
          </p>
          {order.deliveryAddress && (
            <p className="text-sm text-[var(--color-text-secondary)]">{order.deliveryAddress}</p>
          )}
          <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
            Номер відстеження з&apos;явиться після відправки замовлення.
          </p>
        </div>
      )}

      {/* Status timeline */}
      {order.statusHistory.length > 0 && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Хронологія
          </h2>
          <ol className="relative space-y-3 border-l border-[var(--color-border)] pl-5">
            {order.statusHistory.map((h, idx) => {
              const isLatest = idx === order.statusHistory.length - 1;
              const statusKey = h.newStatus as OrderStatus;
              const color = ORDER_STATUS_COLORS[statusKey] || '#9CA3AF';
              return (
                <li key={h.id} className="relative">
                  <span
                    className={`absolute -left-[1.45rem] mt-1.5 h-3 w-3 rounded-full ring-4 ring-[var(--color-bg)] ${
                      isLatest ? '' : 'opacity-60'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">
                      {ORDER_STATUS_LABELS[statusKey] || h.newStatus}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {formatDateTime(h.createdAt)}
                    </span>
                  </div>
                  {h.comment && (
                    <p className="text-xs text-[var(--color-text-secondary)]">{h.comment}</p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Items */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Товари
        </h2>
        <ul className="divide-y divide-[var(--color-border)]">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.productName}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {item.productCode} · {item.quantity} шт × {Number(item.priceAtOrder).toFixed(0)} ₴
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">
                {Number(item.subtotal).toFixed(0)} ₴
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
          <span className="text-sm text-[var(--color-text-secondary)]">Загалом</span>
          <span className="text-lg font-bold tabular-nums">
            {Number(order.totalAmount).toFixed(0)} ₴
          </span>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-[var(--color-text-secondary)]">
        Сторінка оновлюється автоматично кожні 60 секунд.
      </p>
    </div>
  );
}
