'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { formatPrice } from '@/utils/format';
import Spinner from '@/components/ui/Spinner';
import { ORDER_STATUS_COLORS } from '@/types/order';
import type { OrderStatus } from '@/types/order';
import { ALLOWED_ORDER_TRANSITIONS } from '@/config/admin-constants';

// Columns shown on the board. Terminal states (cancelled/returned) hidden — they
// would clutter the operational view and aren't drop targets anyway.
const BOARD_COLUMNS: OrderStatus[] = [
  'new_order',
  'processing',
  'confirmed',
  'paid',
  'shipped',
  'completed',
];

interface BoardOrder {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: string | number;
  contactName: string;
  contactPhone: string;
  trackingNumber: string | null;
  createdAt: string | Date;
}

interface BoardResponse {
  orders: BoardOrder[];
  total: number;
  truncated: boolean;
  cap: number;
}

export default function AdminOrdersBoardPage() {
  const t = useTranslations('admin.ordersBoard');
  const tl = useTranslations('orderLabels');
  const [orders, setOrders] = useState<BoardOrder[]>([]);
  const [boardMeta, setBoardMeta] = useState<{
    total: number;
    truncated: boolean;
    cap: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [hoverColumn, setHoverColumn] = useState<OrderStatus | null>(null);

  const [reloadToken, setReloadToken] = useState(0);
  const fetchOrders = () => setReloadToken((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    // Dedicated board endpoint — multi-status WHERE on the server, no
    // generic 100-row limit. Previously the kanban silently hid the 101st
    // order, so drag-drop appeared to work but couldn't reach cards that
    // weren't rendered.
    apiClient.get<BoardResponse>('/api/v1/admin/orders/board').then((res) => {
      if (cancelled) return;
      if (res.success && res.data) {
        setOrders(res.data.orders);
        setBoardMeta({
          total: res.data.total,
          truncated: res.data.truncated,
          cap: res.data.cap,
        });
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const handleDragStart = (id: number) => () => setDraggingId(id);

  const handleDragEnd = () => {
    setDraggingId(null);
    setHoverColumn(null);
  };

  const handleDragOver = (col: OrderStatus) => (e: React.DragEvent) => {
    e.preventDefault();
    setHoverColumn(col);
  };

  const handleDrop = (target: OrderStatus) => async (e: React.DragEvent) => {
    e.preventDefault();
    setHoverColumn(null);
    if (draggingId === null) return;
    const order = orders.find((o) => o.id === draggingId);
    setDraggingId(null);
    if (!order || order.status === target) return;

    const allowed = ALLOWED_ORDER_TRANSITIONS[order.status] || [];
    if (!allowed.includes(target)) {
      toast.error(
        t('transitionForbidden', {
          from: tl(`status.${order.status}`),
          to: tl(`status.${target}`),
        }),
      );
      return;
    }

    // Optimistic update — revert on failure. Snapshot ONLY the affected
    // order by ID, not the entire array, so a concurrent reload between
    // drag-start and drop-end doesn't restore stale data for unrelated
    // orders.
    const originalStatus = order.status;
    setOrders((all) => all.map((o) => (o.id === order.id ? { ...o, status: target } : o)));
    const res = await apiClient.put(`/api/v1/admin/orders/${order.id}/status`, {
      status: target,
    });
    if (res.success) {
      toast.success(t('updateSuccess', { number: order.orderNumber, to: tl(`status.${target}`) }));
    } else {
      toast.error(res.error || t('updateFailed'));
      setOrders((all) =>
        all.map((o) => (o.id === order.id ? { ...o, status: originalStatus } : o)),
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('title')}</h1>
          <p className="text-xs text-[var(--color-text-secondary)]">{t('intro')}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/orders"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-bg-secondary)]"
          >
            {t('viewTable')}
          </Link>
          <button
            onClick={fetchOrders}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-bg-secondary)]"
          >
            {t('refresh')}
          </button>
        </div>
      </div>

      {boardMeta?.truncated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t('truncatedPrefix')} {boardMeta.total}, {t('truncatedShown')} {boardMeta.cap}{' '}
          {t('truncatedSuffix')}{' '}
          <Link href="/admin/orders" className="font-semibold underline">
            {t('truncatedTableLink')}
          </Link>{' '}
          {t('truncatedTail')}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {BOARD_COLUMNS.map((col) => {
          const cards = orders.filter((o) => o.status === col);
          const allowed =
            draggingId !== null
              ? orders.find((o) => o.id === draggingId)?.status === col
                ? false
                : ALLOWED_ORDER_TRANSITIONS[
                    orders.find((o) => o.id === draggingId)?.status as string
                  ]?.includes(col)
              : null;
          const isDropTarget = draggingId !== null && allowed;
          return (
            <div
              key={col}
              onDragOver={handleDragOver(col)}
              onDrop={handleDrop(col)}
              onDragLeave={() => setHoverColumn(null)}
              className={`flex min-h-[60vh] flex-col rounded-xl border bg-[var(--color-bg)] transition-colors ${
                hoverColumn === col && isDropTarget
                  ? 'border-emerald-500 bg-emerald-50'
                  : isDropTarget
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : draggingId !== null && allowed === false
                      ? 'border-red-200 opacity-60'
                      : 'border-[var(--color-border)]'
              }`}
            >
              <div
                className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2"
                style={{ borderTopColor: ORDER_STATUS_COLORS[col], borderTopWidth: 3 }}
              >
                <span className="text-sm font-semibold">{tl(`status.${col}`)}</span>
                <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs">
                  {cards.length}
                </span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {cards.length === 0 && (
                  <p className="py-6 text-center text-xs text-[var(--color-text-secondary)]">
                    {t('empty')}
                  </p>
                )}
                {cards.map((order) => (
                  <Link
                    key={order.id}
                    href={`/admin/orders/${order.id}`}
                    draggable
                    onDragStart={handleDragStart(order.id)}
                    onDragEnd={handleDragEnd}
                    className={`block cursor-grab rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 text-xs shadow-sm transition-all hover:shadow-md active:cursor-grabbing ${
                      draggingId === order.id ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-bold text-[var(--color-primary)]">
                        №{order.orderNumber}
                      </span>
                      <span className="font-semibold">
                        {formatPrice(Number(order.totalAmount))}
                      </span>
                    </div>
                    <p className="truncate text-[var(--color-text)]">{order.contactName}</p>
                    <p className="truncate text-[var(--color-text-secondary)]">
                      {order.contactPhone}
                    </p>
                    {order.trackingNumber && (
                      <p className="mt-1 truncate text-[10px] text-violet-700">
                        {t('tracking')} {order.trackingNumber}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
                      {new Date(order.createdAt).toLocaleDateString('uk-UA', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
