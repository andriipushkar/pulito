'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { apiClient, getAccessToken } from '@/lib/api-client';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  DELIVERY_METHOD_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/types/order';
import type { OrderListItem, OrderStatus, PaymentStatus, PaymentMethod, DeliveryMethod } from '@/types/order';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton, { AdminStatsSkeleton } from '@/components/admin/AdminTableSkeleton';
import PageSizeSelector from '@/components/admin/PageSizeSelector';
import { useDebounce } from '@/hooks/useDebounce';
import { Search } from '@/components/icons';
import {
  DEFAULT_PAGE_SIZE,
  ORDER_STATS_POLL_INTERVAL,
  ALLOWED_ORDER_TRANSITIONS,
  SEARCH_DEBOUNCE_MS,
} from '@/config/admin-constants';

const STATUS_OPTIONS = [
  { value: '', label: 'Всі статуси' },
  ...Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

const CLIENT_TYPE_OPTIONS = [
  { value: '', label: 'Всі типи' },
  { value: 'retail', label: 'Роздріб' },
  { value: 'wholesale', label: 'Опт' },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: '', label: 'Всі способи оплати' },
  ...Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

const DELIVERY_METHOD_OPTIONS = [
  { value: '', label: 'Вся доставка' },
  ...Object.entries(DELIVERY_METHOD_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Найновіші' },
  { value: 'createdAt:asc', label: 'Найстаріші' },
  { value: 'totalAmount:desc', label: 'Сума (більше)' },
  { value: 'totalAmount:asc', label: 'Сума (менше)' },
  { value: 'status:asc', label: 'Статус (A-Z)' },
  { value: 'orderNumber:desc', label: 'Номер (новіші)' },
];

interface OrderStats {
  newOrders: number;
  processingOrders: number;
  todayOrders: number;
  todayRevenue: number;
  unpaidOrders: number;
}

// Notification sound (short beep via Web Audio API)
function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gain.gain.value = 0.3;
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio not available
  }
}

export default function AdminOrdersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [quickStatusOrderId, setQuickStatusOrderId] = useState<number | null>(null);
  const [quickStatusValue, setQuickStatusValue] = useState('');
  const [quickStatusUpdating, setQuickStatusUpdating] = useState(false);
  const [newOrdersBadge, setNewOrdersBadge] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [confirmStatusChange, setConfirmStatusChange] = useState<{orderId: number; status: string} | null>(null);
  const lastKnownNewRef = useRef<number | null>(null);

  const page = Number(searchParams.get('page')) || 1;
  const status = searchParams.get('status') || '';
  const clientType = searchParams.get('clientType') || '';
  const paymentMethod = searchParams.get('paymentMethod') || '';
  const deliveryMethod = searchParams.get('deliveryMethod') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const search = searchParams.get('search') || '';
  const sortParam = searchParams.get('sort') || 'createdAt:desc';
  const [sortBy, sortOrder] = sortParam.split(':') as [string, string];
  const limit = Number(searchParams.get('limit')) || DEFAULT_PAGE_SIZE;

  // Debounced search
  const debouncedSearch = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    const currentSearch = searchParams.get('search') || '';
    if (debouncedSearch !== currentSearch) {
      updateFilter('search', debouncedSearch);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const hasFilters = !!(status || clientType || paymentMethod || deliveryMethod || dateFrom || dateTo || search);

  const loadOrders = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
    });
    if (status) params.set('status', status);
    if (clientType) params.set('clientType', clientType);
    if (paymentMethod) params.set('paymentMethod', paymentMethod);
    if (deliveryMethod) params.set('deliveryMethod', deliveryMethod);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (search) params.set('search', search);

    apiClient
      .get<OrderListItem[]>(`/api/v1/admin/orders?${params}`)
      .then((res) => {
        if (res.success && res.data) {
          setOrders(res.data);
          setTotal(res.pagination?.total || 0);
        } else {
          toast.error('Не вдалося завантажити замовлення');
        }
      })
      .catch(() => toast.error('Помилка мережі'))
      .finally(() => setIsLoading(false));
  }, [page, limit, status, clientType, paymentMethod, deliveryMethod, dateFrom, dateTo, search, sortBy, sortOrder]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Load stats
  const loadStats = useCallback(() => {
    apiClient.get<OrderStats>('/api/v1/admin/orders?stats=true').then((res) => {
      if (res.success && res.data) {
        setStats(res.data);

        // New order notification
        if (lastKnownNewRef.current !== null && res.data.newOrders > lastKnownNewRef.current) {
          const diff = res.data.newOrders - lastKnownNewRef.current;
          setNewOrdersBadge((prev) => prev + diff);
          playNotificationSound();
          toast.info(`+${diff} нових замовлень!`);
        }
        lastKnownNewRef.current = res.data.newOrders;
      }
    });
  }, []);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, ORDER_STATS_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [loadStats]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    router.push(`/admin/orders?${params}`);
  };

  const handlePageSizeChange = (size: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('limit', String(size));
    params.set('page', '1');
    router.push(`/admin/orders?${params}`);
  };

  const handleQuickStatusInit = (orderId: number, newStatusVal: string) => {
    if (!newStatusVal) return;
    setConfirmStatusChange({ orderId, status: newStatusVal });
  };

  const handleQuickStatusConfirm = async () => {
    if (!confirmStatusChange) return;
    setQuickStatusUpdating(true);
    const res = await apiClient.put(`/api/v1/admin/orders/${confirmStatusChange.orderId}/status`, { status: confirmStatusChange.status });
    if (res.success) {
      toast.success(`Статус змінено на "${ORDER_STATUS_LABELS[confirmStatusChange.status as OrderStatus]}"`);
      loadOrders();
      loadStats();
    } else {
      toast.error(res.error || 'Помилка зміни статусу');
    }
    setConfirmStatusChange(null);
    setQuickStatusOrderId(null);
    setQuickStatusValue('');
    setQuickStatusUpdating(false);
  };

  const handleExport = async () => {
    const params = new URLSearchParams({ type: 'orders', format: 'xlsx' });
    if (status) params.set('status', status);
    if (clientType) params.set('clientType', clientType);
    if (paymentMethod) params.set('paymentMethod', paymentMethod);
    if (deliveryMethod) params.set('deliveryMethod', deliveryMethod);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (search) params.set('search', search);

    try {
      const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
      const token = getAccessToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/admin/export?${params}`, {
        headers,
        credentials: 'include',
      });

      if (!res.ok) {
        toast.error('Помилка експорту');
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || `orders_${new Date().toISOString().slice(0, 10)}.xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Експорт завершено');
    } catch {
      toast.error('Помилка експорту');
    }
  };

  const handleNewOrdersBadgeClick = () => {
    setNewOrdersBadge(0);
    updateFilter('status', 'new_order');
  };

  const formatDate = (d: string | Date) =>
    new Date(d).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const paymentStatusColor = (s: string) => {
    switch (s) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'partial': return 'bg-blue-100 text-blue-700';
      case 'refunded': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Замовлення</h2>
          {newOrdersBadge > 0 && (
            <button
              onClick={handleNewOrdersBadgeClick}
              className="animate-pulse rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white transition-transform hover:scale-110"
            >
              +{newOrdersBadge} нових
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? 'Сховати фільтри' : 'Фільтри'}
            {hasFilters && !showFilters && (
              <span className="ml-1 inline-block h-2 w-2 rounded-full bg-[var(--color-primary)]" />
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            Експорт
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      {!stats ? (
        <AdminStatsSkeleton count={5} />
      ) : (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Нових"
            value={stats.newOrders}
            color="text-blue-600"
            bg="bg-blue-50"
            onClick={() => updateFilter('status', 'new_order')}
          />
          <StatCard
            label="В обробці"
            value={stats.processingOrders}
            color="text-amber-600"
            bg="bg-amber-50"
            onClick={() => updateFilter('status', 'processing')}
          />
          <StatCard
            label="Очікують оплати"
            value={stats.unpaidOrders}
            color="text-red-600"
            bg="bg-red-50"
          />
          <StatCard
            label="Замовлень сьогодні"
            value={stats.todayOrders}
            color="text-violet-600"
            bg="bg-violet-50"
          />
          <StatCard
            label="Виручка сьогодні"
            value={`${stats.todayRevenue.toFixed(0)} \u20B4`}
            color="text-emerald-600"
            bg="bg-emerald-50"
          />
        </div>
      )}

      {/* Search + Sort row */}
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Номер, ім\u02BCя, телефон, ТТН..."
            className="w-64 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <Select
          options={SORT_OPTIONS}
          value={sortParam}
          onChange={(e) => updateFilter('sort', e.target.value)}
          className="w-44"
        />
        {hasFilters && (
          <button
            onClick={() => router.push('/admin/orders')}
            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:underline"
          >
            Скинути фільтри
          </button>
        )}
      </div>

      {/* Extended filters */}
      {showFilters && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">Статус</label>
            <Select
              options={STATUS_OPTIONS}
              value={status}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">Тип клієнта</label>
            <Select
              options={CLIENT_TYPE_OPTIONS}
              value={clientType}
              onChange={(e) => updateFilter('clientType', e.target.value)}
              className="w-32"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">Спосіб оплати</label>
            <Select
              options={PAYMENT_METHOD_OPTIONS}
              value={paymentMethod}
              onChange={(e) => updateFilter('paymentMethod', e.target.value)}
              className="w-48"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">Доставка</label>
            <Select
              options={DELIVERY_METHOD_OPTIONS}
              value={deliveryMethod}
              onChange={(e) => updateFilter('deliveryMethod', e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">Дата від</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-[7px] text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">Дата до</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-[7px] text-sm"
            />
          </div>
        </div>
      )}

      {isLoading ? (
        <AdminTableSkeleton rows={10} columns={7} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="px-3 py-3 text-left font-medium">Замовлення</th>
                  <th className="px-3 py-3 text-left font-medium">Клієнт</th>
                  <th className="px-3 py-3 text-left font-medium">Статус</th>
                  <th className="px-3 py-3 text-left font-medium">Оплата</th>
                  <th className="px-3 py-3 text-left font-medium">Доставка</th>
                  <th className="px-3 py-3 text-right font-medium">Сума</th>
                  <th className="px-3 py-3 text-center font-medium w-10">Дії</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const transitions = ALLOWED_ORDER_TRANSITIONS[order.status] || [];
                  return (
                    <tr
                      key={order.id}
                      className="border-b border-[var(--color-border)] last:border-0 transition-colors hover:bg-[var(--color-bg-secondary)]"
                    >
                      <td className="px-3 py-3">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-medium text-[var(--color-primary)] hover:underline"
                        >
                          #{order.orderNumber}
                        </Link>
                        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                          {formatDate(order.createdAt)}
                        </p>
                        {order.itemsCount > 0 && (
                          <p className="text-[11px] text-[var(--color-text-secondary)]">
                            {order.itemsCount} {order.itemsCount === 1 ? 'товар' : order.itemsCount < 5 ? 'товари' : 'товарів'}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-sm">{order.contactName}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">{order.contactPhone}</p>
                        {order.clientType === 'wholesale' && (
                          <span className="mt-0.5 inline-block rounded bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-primary)]">
                            ОПТ
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                          style={{
                            backgroundColor: ORDER_STATUS_COLORS[order.status as OrderStatus],
                          }}
                        >
                          {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                          {PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod]}
                        </p>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${paymentStatusColor(order.paymentStatus)}`}
                        >
                          {PAYMENT_STATUS_LABELS[order.paymentStatus as PaymentStatus]}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-xs">{DELIVERY_METHOD_LABELS[order.deliveryMethod as DeliveryMethod]}</p>
                        {order.trackingNumber && (
                          <p className="mt-0.5 text-[11px] font-medium text-[var(--color-primary)]">
                            TTH: {order.trackingNumber}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-bold">{Number(order.totalAmount).toFixed(2)} &#8372;</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {transitions.length > 0 && (
                          <div className="relative">
                            {quickStatusOrderId === order.id ? (
                              <div className="flex items-center gap-1">
                                <select
                                  value={quickStatusValue}
                                  onChange={(e) => setQuickStatusValue(e.target.value)}
                                  className="w-28 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-1 text-[11px]"
                                  autoFocus
                                >
                                  <option value="">Статус...</option>
                                  {transitions.map((s) => (
                                    <option key={s} value={s}>
                                      {ORDER_STATUS_LABELS[s as OrderStatus]}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleQuickStatusInit(order.id, quickStatusValue)}
                                  disabled={!quickStatusValue || quickStatusUpdating}
                                  className="rounded bg-[var(--color-primary)] px-1.5 py-1 text-[10px] font-medium text-white disabled:opacity-50"
                                >
                                  {quickStatusUpdating ? '...' : 'OK'}
                                </button>
                                <button
                                  onClick={() => {
                                    setQuickStatusOrderId(null);
                                    setQuickStatusValue('');
                                  }}
                                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                                >
                                  &times;
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setQuickStatusOrderId(order.id)}
                                title="Швидка зміна статусу"
                                className="rounded p-1 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-primary)]"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {orders.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-[var(--color-text-secondary)]"
                    >
                      Замовлень не знайдено
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <p className="text-xs text-[var(--color-text-secondary)]">Всього: {total}</p>
              <PageSizeSelector value={limit} onChange={handlePageSizeChange} />
            </div>
            {total > limit && (
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(total / limit)}
                baseUrl="/admin/orders"
              />
            )}
          </div>
        </>
      )}

      {/* Confirm status change */}
      <ConfirmDialog
        isOpen={!!confirmStatusChange}
        onClose={() => setConfirmStatusChange(null)}
        onConfirm={handleQuickStatusConfirm}
        variant="warning"
        title="Зміна статусу"
        message={confirmStatusChange ? `Змінити статус замовлення на "${ORDER_STATUS_LABELS[confirmStatusChange.status as OrderStatus]}"?` : ''}
        confirmText="Так, змінити"
        isLoading={quickStatusUpdating}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  bg,
  onClick,
}: {
  label: string;
  value: string | number;
  color: string;
  bg: string;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`rounded-xl ${bg} px-4 py-3 text-left transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]' : ''}`}
    >
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{label}</p>
    </Wrapper>
  );
}
