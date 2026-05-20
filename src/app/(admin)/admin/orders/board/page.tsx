'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { formatPrice } from '@/utils/format';
import Spinner from '@/components/ui/Spinner';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types/order';
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

// paginatedResponse wraps the array under .data directly — there is no
// nested .orders key (that was the source of an "empty board" bug).

export default function AdminOrdersBoardPage() {
  const [orders, setOrders] = useState<BoardOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [hoverColumn, setHoverColumn] = useState<OrderStatus | null>(null);

  const [reloadToken, setReloadToken] = useState(0);
  const fetchOrders = () => setReloadToken((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    // Cap at 100 (API max) — anything above is laggy on a daily board.
    // Status filter is single-value at the API layer, so drop terminal states
    // (cancelled/returned) on the client to keep the operational view clean.
    apiClient
      .get<BoardOrder[]>('/api/v1/admin/orders?limit=100&sortBy=createdAt&sortOrder=desc')
      .then((res) => {
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) {
          const activeOnly = res.data.filter((o) => BOARD_COLUMNS.includes(o.status));
          setOrders(activeOnly);
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
        `Неможливо: "${ORDER_STATUS_LABELS[order.status]}" → "${ORDER_STATUS_LABELS[target]}"`,
      );
      return;
    }

    // Optimistic update — revert on failure so the user sees the card snap back.
    const previous = orders;
    setOrders((all) => all.map((o) => (o.id === order.id ? { ...o, status: target } : o)));
    const res = await apiClient.put(`/api/v1/admin/orders/${order.id}/status`, {
      status: target,
    });
    if (res.success) {
      toast.success(`#${order.orderNumber} → ${ORDER_STATUS_LABELS[target]}`);
    } else {
      toast.error(res.error || 'Не вдалося оновити статус');
      setOrders(previous);
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
          <h1 className="text-xl font-bold">Дошка замовлень</h1>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Перетягуйте картки між колонками щоб змінити статус. Дозволені переходи
            підсвічуються зеленим при перетягуванні.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/orders"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-bg-secondary)]"
          >
            Таблиця
          </Link>
          <button
            onClick={fetchOrders}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-bg-secondary)]"
          >
            Оновити
          </button>
        </div>
      </div>

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
                <span className="text-sm font-semibold">{ORDER_STATUS_LABELS[col]}</span>
                <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs">
                  {cards.length}
                </span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {cards.length === 0 && (
                  <p className="py-6 text-center text-xs text-[var(--color-text-secondary)]">
                    Порожньо
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
                      <span className="font-semibold">{formatPrice(Number(order.totalAmount))}</span>
                    </div>
                    <p className="truncate text-[var(--color-text)]">{order.contactName}</p>
                    <p className="truncate text-[var(--color-text-secondary)]">
                      {order.contactPhone}
                    </p>
                    {order.trackingNumber && (
                      <p className="mt-1 truncate text-[10px] text-violet-700">
                        ТТН: {order.trackingNumber}
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
