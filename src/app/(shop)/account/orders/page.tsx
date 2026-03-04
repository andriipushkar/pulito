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
import PageHeader from '@/components/account/PageHeader';
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
      <PageHeader
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        }
        title="Мої замовлення"
        subtitle="Історія та відстеження"
        actions={
          <Select
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-44"
          />
        }
      />

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
          {/* Orders count */}
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
              {total}
            </span>
            <span className="text-sm text-[var(--color-text-secondary)]">
              {total === 1 ? 'замовлення' : total < 5 ? 'замовлення' : 'замовлень'}
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)]">
            {orders.map((order, index) => (
              <Link
                key={order.id}
                href={`/account/orders/${order.id}`}
                className={`group block transition-colors hover:bg-[var(--color-bg-secondary)]/50${index < orders.length - 1 ? ' border-b border-[var(--color-border)]/60' : ''}`}
              >
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 transition-colors group-hover:bg-orange-100">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <div>
                        <span className="text-sm font-bold">#{order.orderNumber}</span>
                        <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                          {formatDate(order.createdAt)}
                        </span>
                      </div>
                    </div>
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ backgroundColor: ORDER_STATUS_COLORS[order.status as OrderStatus] + '18', color: ORDER_STATUS_COLORS[order.status as OrderStatus] }}
                    >
                      {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-secondary)]">
                      <span className="flex items-center gap-1">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        {order.itemsCount} товар(ів)
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                        </svg>
                        {DELIVERY_METHOD_LABELS[order.deliveryMethod]}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                        </svg>
                        {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                      </span>
                    </div>
                    <span className="text-lg font-bold text-[var(--color-text)]">
                      {Number(order.totalAmount).toFixed(2)} ₴
                    </span>
                  </div>
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
