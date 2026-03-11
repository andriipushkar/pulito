'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types/order';
import type { OrderListItem, OrderStatus } from '@/types/order';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';

const STATUS_OPTIONS = [
  { value: '', label: 'Всі статуси' },
  ...Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

const BULK_ACTIONS = [
  { value: '', label: 'Масова дія...' },
  { value: 'processing', label: 'Статус: В обробці' },
  { value: 'confirmed', label: 'Статус: Підтверджено' },
  { value: 'shipped', label: 'Статус: Відправлено' },
  { value: 'completed', label: 'Статус: Завершено' },
  { value: 'cancelled', label: 'Статус: Скасовано' },
  { value: 'export_csv', label: 'Експорт CSV' },
  { value: 'print_labels', label: 'Друк етикеток' },
];

export default function AdminOrdersBulkPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const page = Number(searchParams.get('page')) || 1;
  const status = searchParams.get('status') || '';
  const limit = 20;

  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set('status', status);

    apiClient
      .get<OrderListItem[]>(`/api/v1/admin/orders?${params}`)
      .then((res) => {
        if (res.success && res.data) {
          setOrders(res.data);
          setTotal(res.pagination?.total || 0);
          setSelected(new Set());
        }
      })
      .finally(() => setIsLoading(false));
  }, [page, status]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    router.push(`/admin/orders/bulk?${params}`);
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === orders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orders.map((o) => o.id)));
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selected.size === 0) return;
    setIsProcessing(true);
    setMessage(null);

    try {
      if (bulkAction === 'export_csv') {
        const ids = Array.from(selected);
        const res = await apiClient.post<{ url: string }>('/api/v1/admin/orders/export', { orderIds: ids, format: 'csv' });
        if (res.success && res.data?.url) {
          window.open(res.data.url, '_blank');
          setMessage({ type: 'success', text: `Експортовано ${ids.length} замовлень` });
        }
      } else if (bulkAction === 'print_labels') {
        const ids = Array.from(selected);
        const res = await apiClient.post<{ url: string }>('/api/v1/admin/orders/labels', { orderIds: ids });
        if (res.success && res.data?.url) {
          window.open(res.data.url, '_blank');
          setMessage({ type: 'success', text: `Створено етикетки для ${ids.length} замовлень` });
        }
      } else {
        // Status update
        const ids = Array.from(selected);
        let successCount = 0;
        for (const id of ids) {
          const res = await apiClient.put(`/api/v1/admin/orders/${id}/status`, { status: bulkAction });
          if (res.success) successCount++;
        }
        setMessage({ type: 'success', text: `Оновлено ${successCount} з ${ids.length} замовлень` });
        // Reload
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (status) params.set('status', status);
        const res = await apiClient.get<OrderListItem[]>(`/api/v1/admin/orders?${params}`);
        if (res.success && res.data) {
          setOrders(res.data);
          setTotal(res.pagination?.total || 0);
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Помилка виконання дії' });
    } finally {
      setIsProcessing(false);
      setBulkAction('');
      setSelected(new Set());
    }
  };

  const formatDate = (d: string | Date) =>
    new Date(d).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Масові дії</h2>
          <Link href="/admin/orders" className="text-sm text-[var(--color-primary)] hover:underline">← Звичайний режим</Link>
        </div>
        <Select options={STATUS_OPTIONS} value={status} onChange={(e) => updateFilter('status', e.target.value)} className="w-44" />
      </div>

      {message && (
        <div className={`mb-4 rounded-[var(--radius)] p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-[var(--color-danger)]'}`}>
          {message.text}
        </div>
      )}

      {/* Bulk action bar */}
      <div className="mb-4 flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2">
        <span className="text-sm text-[var(--color-text-secondary)]">
          Обрано: <strong>{selected.size}</strong>
        </span>
        <Select options={BULK_ACTIONS} value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="w-52" />
        <Button size="sm" onClick={handleBulkAction} isLoading={isProcessing} disabled={!bulkAction || selected.size === 0}>
          Виконати
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="md" /></div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox" checked={selected.size === orders.length && orders.length > 0} onChange={toggleAll} className="accent-[var(--color-primary)]" />
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Номер</th>
                  <th className="px-4 py-3 text-left font-medium">Дата</th>
                  <th className="px-4 py-3 text-left font-medium">Статус</th>
                  <th className="px-4 py-3 text-right font-medium">Сума</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className={`border-b border-[var(--color-border)] last:border-0 ${selected.has(order.id) ? 'bg-[var(--color-primary)]/5' : 'hover:bg-[var(--color-bg-secondary)]'}`}
                  >
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(order.id)} onChange={() => toggleSelect(order.id)} className="accent-[var(--color-primary)]" />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${order.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                        #{order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{formatDate(order.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: ORDER_STATUS_COLORS[order.status as OrderStatus] }}>
                        {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{Number(order.totalAmount).toFixed(2)} ₴</td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">Замовлень не знайдено</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {total > limit && (
            <Pagination currentPage={page} totalPages={Math.ceil(total / limit)} baseUrl="/admin/orders/bulk" className="mt-6" />
          )}
        </>
      )}
    </div>
  );
}
