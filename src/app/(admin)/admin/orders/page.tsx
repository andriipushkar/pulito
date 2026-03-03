'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { apiClient } from '@/lib/api-client';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, DELIVERY_METHOD_LABELS } from '@/types/order';
import type { OrderListItem, OrderStatus } from '@/types/order';
import Select from '@/components/ui/Select';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';
import { Search } from '@/components/icons';

const STATUS_OPTIONS = [
  { value: '', label: 'Всі статуси' },
  ...Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

export default function AdminOrdersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const page = Number(searchParams.get('page')) || 1;
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';
  const limit = 20;

  const loadOrders = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set('status', status);
    if (search) params.set('search', search);

    apiClient
      .get<OrderListItem[]>(`/api/v1/admin/orders?${params}`)
      .then((res) => {
        if (res.success && res.data) {
          setOrders(res.data);
          setTotal(res.pagination?.total || 0);
        }
      })
      .finally(() => setIsLoading(false));
  }, [page, status, search]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set('status', status);
    if (search) params.set('search', search);

    apiClient
      .get<OrderListItem[]>(`/api/v1/admin/orders?${params}`)
      .then((res) => {
        if (res.success && res.data) {
          setOrders(res.data);
          setTotal(res.pagination?.total || 0);
        }
        setSelectedIds(new Set());
      })
      .finally(() => setIsLoading(false));
  }, [page, status, search]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    router.push(`/admin/orders?${params}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilter('search', searchQuery);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkUpdating(true);
    const promises = Array.from(selectedIds).map((id) =>
      apiClient.put(`/api/v1/admin/orders/${id}/status`, { status: bulkStatus })
    );
    await Promise.allSettled(promises);
    setBulkUpdating(false);
    setSelectedIds(new Set());
    setBulkStatus('');
    loadOrders();
  };

  const handleExport = () => {
    const params = new URLSearchParams({ type: 'orders', format: 'xlsx' });
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    window.open(`/api/v1/admin/export?${params}`, '_blank');
  };

  const formatDate = (d: string | Date) =>
    new Date(d).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Замовлення</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExport}>Експорт</Button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук за номером, імʼям, телефоном..."
              className="w-72 rounded-l-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <button type="submit" className="rounded-r-[var(--radius)] bg-[var(--color-primary)] px-4 text-sm text-white">
            Знайти
          </button>
        </form>
        <Select
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="w-44"
        />
      </div>

      {/* Bulk actions toolbar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-[var(--radius)] bg-[var(--color-primary-50)] px-4 py-2">
          <span className="text-sm font-medium">Обрано: {selectedIds.size}</span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
          >
            <option value="">Змінити статус на...</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <Button size="sm" onClick={handleBulkStatusUpdate} isLoading={bulkUpdating} disabled={!bulkStatus}>
            Застосувати
          </Button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-[var(--color-text-secondary)] hover:underline">
            Скасувати вибір
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={orders.length > 0 && selectedIds.size === orders.length}
                      onChange={toggleSelectAll}
                      className="accent-[var(--color-primary)]"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Номер</th>
                  <th className="px-4 py-3 text-left font-medium">Дата</th>
                  <th className="px-4 py-3 text-left font-medium">Статус</th>
                  <th className="px-4 py-3 text-left font-medium">Тип</th>
                  <th className="px-4 py-3 text-left font-medium">Доставка</th>
                  <th className="px-4 py-3 text-right font-medium">Сума</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className={`border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)] ${selectedIds.has(order.id) ? 'bg-[var(--color-primary-50)]' : ''}`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(order.id)}
                        onChange={() => toggleSelect(order.id)}
                        className="accent-[var(--color-primary)]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-medium text-[var(--color-primary)] hover:underline"
                      >
                        #{order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: ORDER_STATUS_COLORS[order.status as OrderStatus] }}
                      >
                        {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${order.clientType === 'wholesale' ? 'font-semibold text-[var(--color-primary)]' : ''}`}>
                        {order.clientType === 'wholesale' ? 'Опт' : 'Роздріб'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {DELIVERY_METHOD_LABELS[order.deliveryMethod]}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {Number(order.totalAmount).toFixed(2)} ₴
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                      Замовлень не знайдено
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {total > limit && (
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / limit)}
              baseUrl="/admin/orders"
              className="mt-6"
            />
          )}
        </>
      )}
    </div>
  );
}
