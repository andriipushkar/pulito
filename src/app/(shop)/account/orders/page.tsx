'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, DELIVERY_METHOD_LABELS, PAYMENT_METHOD_LABELS } from '@/types/order';
import type { OrderListItem, OrderStatus } from '@/types/order';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import Select from '@/components/ui/Select';
import { Cart } from '@/components/icons';

const STATUS_OPTIONS = [
  { value: '', label: 'Всі статуси' },
  ...Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const limit = 10;

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set('status', status);

    apiClient
      .get<OrderListItem[]>(`/api/v1/orders?${params}`)
      .then((res) => {
        if (res.success && res.data) {
          setOrders(res.data);
          setTotal(res.pagination?.total || 0);
        }
      })
      .finally(() => setIsLoading(false));
  }, [page, status]);

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Мої замовлення</h2>
        <Select
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="w-44"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Cart size={48} />}
          title="Замовлень немає"
          description={status ? 'Немає замовлень з обраним статусом' : 'Ви ще не зробили жодного замовлення'}
          actionLabel="Перейти до каталогу"
          actionHref="/catalog"
        />
      ) : (
        <>
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/account/orders/${order.id}`}
                className="block rounded-[var(--radius)] border border-[var(--color-border)] p-4 transition-colors hover:border-[var(--color-primary)]/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-sm font-semibold">#{order.orderNumber}</span>
                    <span className="ml-2 text-sm text-[var(--color-text-secondary)]">
                      {formatDate(order.createdAt)}
                    </span>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: ORDER_STATUS_COLORS[order.status as OrderStatus] }}
                  >
                    {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-[var(--color-text-secondary)]">
                  <span>{order.itemsCount} товар(ів)</span>
                  <span>{DELIVERY_METHOD_LABELS[order.deliveryMethod]}</span>
                  <span>{PAYMENT_METHOD_LABELS[order.paymentMethod]}</span>
                </div>
                <div className="mt-2 text-right">
                  <span className="text-lg font-bold">{Number(order.totalAmount).toFixed(2)} ₴</span>
                </div>
              </Link>
            ))}
          </div>

          {total > limit && (
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / limit)}
              baseUrl="/account/orders"
              className="mt-6"
            />
          )}
        </>
      )}
    </div>
  );
}
