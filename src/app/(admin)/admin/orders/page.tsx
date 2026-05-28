'use client';

import { useEffect, useState, useCallback, useRef, useMemo, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import { apiClient, getAccessToken } from '@/lib/api-client';
import { formatPrice, formatDateTime } from '@/utils/format';
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUSES,
  DELIVERY_METHODS,
  PAYMENT_METHODS,
} from '@/types/order';
import type {
  OrderListItem,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  DeliveryMethod,
} from '@/types/order';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton, { AdminStatsSkeleton } from '@/components/admin/AdminTableSkeleton';
import PageSizeSelector from '@/components/admin/PageSizeSelector';
import SavedViews from '@/components/admin/SavedViews';
import OrderQuickEditDrawer from '@/components/admin/OrderQuickEditDrawer';
import KeyboardShortcutsHelp from '@/components/admin/KeyboardShortcutsHelp';
import { useDebounce } from '@/hooks/useDebounce';
import { useOrderListKeyboard } from '@/hooks/useOrderListKeyboard';
import { Search } from '@/components/icons';
import {
  DEFAULT_PAGE_SIZE,
  ORDER_STATS_POLL_INTERVAL,
  ALLOWED_ORDER_TRANSITIONS,
  SEARCH_DEBOUNCE_MS,
} from '@/config/admin-constants';

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
  return (
    <Suspense fallback={<AdminTableSkeleton rows={10} columns={8} />}>
      <AdminOrdersPageInner />
    </Suspense>
  );
}

function AdminOrdersPageInner() {
  const t = useTranslations('admin.ordersListPage');
  const tl = useTranslations('orderLabels');
  const STATUS_OPTIONS = useMemo(
    () => [
      { value: '', label: t('allStatuses') },
      ...ORDER_STATUSES.map((v) => ({ value: v, label: tl(`status.${v}`) })),
    ],
    [t, tl],
  );
  const CLIENT_TYPE_OPTIONS = useMemo(
    () => [
      { value: '', label: t('ctAll') },
      { value: 'retail', label: t('ctRetail') },
      { value: 'wholesale', label: t('ctWholesale') },
    ],
    [t],
  );
  const PAYMENT_METHOD_OPTIONS = useMemo(
    () => [
      { value: '', label: t('allPayment') },
      ...PAYMENT_METHODS.map((v) => ({ value: v, label: tl(`paymentMethod.${v}`) })),
    ],
    [t, tl],
  );
  const DELIVERY_METHOD_OPTIONS = useMemo(
    () => [
      { value: '', label: t('allDelivery') },
      ...DELIVERY_METHODS.map((v) => ({ value: v, label: tl(`deliveryMethod.${v}`) })),
    ],
    [t, tl],
  );
  const SORT_OPTIONS = useMemo(
    () => [
      { value: 'createdAt:desc', label: t('sortNewest') },
      { value: 'createdAt:asc', label: t('sortOldest') },
      { value: 'totalAmount:desc', label: t('sortAmountDesc') },
      { value: 'totalAmount:asc', label: t('sortAmountAsc') },
      { value: 'status:asc', label: t('sortStatusAsc') },
      { value: 'orderNumber:desc', label: t('sortNumberDesc') },
    ],
    [t],
  );
  const searchParams = useSearchParams();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [quickStatusOrderId, setQuickStatusOrderId] = useState<number | null>(null);
  const [quickStatusValue, setQuickStatusValue] = useState('');
  const [quickStatusUpdating, setQuickStatusUpdating] = useState(false);
  const [newOrdersBadge, setNewOrdersBadge] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [quickEditId, setQuickEditId] = useState<number | null>(null);
  const [isBulkTtnRunning, setIsBulkTtnRunning] = useState(false);
  const [bulkTtnConfirm, setBulkTtnConfirm] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [isBulkStatusRunning, setIsBulkStatusRunning] = useState(false);
  const [bulkStatusConfirm, setBulkStatusConfirm] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(-1);
  const { helpOpen, setHelpOpen } = useOrderListKeyboard({
    orderIds: orders.map((o) => o.id),
    focusIndex,
    setFocusIndex,
    onQuickEdit: (id) => setQuickEditId(id),
    onQuickStatus: (id) => setQuickStatusOrderId(id),
  });

  // Reset focus when the actual list contents change so j/k starts from
  // the top. Depending on `orders.length` missed the case where a filter
  // swaps orders for the same count and focusIndex pointed at the wrong row.
  const ordersFocusSig = orders.map((o) => o.id).join(',');
  useEffect(() => {
    setFocusIndex(-1);
  }, [ordersFocusSig]);

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(orders.map((o) => o.id)));
  };

  // Synchronous in-flight guards. React's setState is async, so the
  // `isBulkTtnRunning` flag doesn't disable the confirm button until the
  // next render. A ref blocks the duplicate call immediately.
  const bulkTtnInFlight = useRef(false);
  const bulkStatusInFlight = useRef(false);

  const handleBulkTtn = async () => {
    if (selectedIds.size === 0) return;
    if (bulkTtnInFlight.current) return;
    bulkTtnInFlight.current = true;
    setIsBulkTtnRunning(true);
    try {
      const res = await apiClient.post<{
        ok: { orderNumber: string; trackingNumber: string }[];
        failed: { orderNumber: string; error: string }[];
      }>('/api/v1/admin/orders/bulk-ttn', { orderIds: Array.from(selectedIds) });
      if (res.success && res.data) {
        const { ok, failed } = res.data;
        if (ok.length > 0) {
          toast.success(t('ttnCreated', { count: ok.length }));
        }
        if (failed.length > 0) {
          const details =
            failed
              .slice(0, 3)
              .map((f) => `#${f.orderNumber} (${f.error})`)
              .join('; ') + (failed.length > 3 ? '…' : '');
          toast.error(t('ttnFailed', { count: failed.length, details }), { duration: 8000 });
        }
        setSelectedIds(new Set());
        // Refresh list to show new tracking numbers
        loadOrders();
      } else {
        toast.error(res.error || t('ttnError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      bulkTtnInFlight.current = false;
      setIsBulkTtnRunning(false);
      setBulkTtnConfirm(false);
    }
  };

  const handleBulkStatus = async (statusToApply: string) => {
    if (selectedIds.size === 0 || !statusToApply) return;
    if (bulkStatusInFlight.current) return;
    bulkStatusInFlight.current = true;
    setIsBulkStatusRunning(true);
    try {
      const res = await apiClient.post<{
        ok: { orderId: number; orderNumber: string; status: string }[];
        failed: { orderId: number; orderNumber: string; error: string }[];
      }>('/api/v1/admin/orders/bulk-status', {
        orderIds: Array.from(selectedIds),
        status: statusToApply,
      });
      if (res.success && res.data) {
        const { ok, failed } = res.data;
        if (ok.length > 0) {
          toast.success(
            t('statusUpdatedN', {
              count: ok.length,
              status: tl(`status.${statusToApply as OrderStatus}`),
            }),
          );
        }
        if (failed.length > 0) {
          const details =
            failed
              .slice(0, 3)
              .map((f) => `#${f.orderNumber} (${f.error})`)
              .join('; ') + (failed.length > 3 ? '…' : '');
          toast.error(t('statusFailedN', { count: failed.length, details }), { duration: 8000 });
        }
        setSelectedIds(new Set());
        setBulkStatus('');
        loadOrders();
        loadStats();
      } else {
        toast.error(res.error || t('statusError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      bulkStatusInFlight.current = false;
      setIsBulkStatusRunning(false);
      setBulkStatusConfirm(null);
    }
  };

  const [confirmStatusChange, setConfirmStatusChange] = useState<{
    orderId: number;
    status: string;
  } | null>(null);
  const lastKnownNewRef = useRef<number | null>(null);

  const page = Number(searchParams.get('page')) || 1;
  const status = searchParams.get('status') || '';
  const clientType = searchParams.get('clientType') || '';
  const paymentMethod = searchParams.get('paymentMethod') || '';
  const paymentStatus = searchParams.get('paymentStatus') || '';
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

  const hasFilters = !!(
    status ||
    clientType ||
    paymentMethod ||
    paymentStatus ||
    deliveryMethod ||
    dateFrom ||
    dateTo ||
    search
  );

  const buildOrdersQuery = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
    });
    if (status) params.set('status', status);
    if (clientType) params.set('clientType', clientType);
    if (paymentMethod) params.set('paymentMethod', paymentMethod);
    if (paymentStatus) params.set('paymentStatus', paymentStatus);
    if (deliveryMethod) params.set('deliveryMethod', deliveryMethod);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (search) params.set('search', search);
    return params.toString();
  }, [
    page,
    limit,
    status,
    clientType,
    paymentMethod,
    paymentStatus,
    deliveryMethod,
    dateFrom,
    dateTo,
    search,
    sortBy,
    sortOrder,
  ]);

  const [ordersReloadToken, setOrdersReloadToken] = useState(0);
  const loadOrders = useCallback(() => setOrdersReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    if (hasLoadedOnceRef.current) setIsRefreshing(true);
    else setIsLoading(true);

    const qs = buildOrdersQuery();
    apiClient
      .get<OrderListItem[]>(`/api/v1/admin/orders?${qs}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setOrders(res.data);
          setTotal(res.pagination?.total || 0);
          hasLoadedOnceRef.current = true;
        } else {
          toast.error(res.error || t('loadError'));
        }
      })
      .catch(() => {
        if (!cancelled) toast.error(t('networkError'));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [buildOrdersQuery, ordersReloadToken, t]);

  // Esc clears bulk selection so the operator can recover without scrolling
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIds(new Set());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedIds.size]);

  // Clear selection when filters/page change so we never apply a bulk action
  // to rows that are no longer visible.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [
    page,
    status,
    clientType,
    paymentMethod,
    paymentStatus,
    deliveryMethod,
    dateFrom,
    dateTo,
    search,
  ]);

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
          toast.info(t('newOrdersToast', { count: diff }));
        }
        lastKnownNewRef.current = res.data.newOrders;
      }
    });
  }, [t]);

  useEffect(() => {
    // Visible-tab gate: don't poll when the tab is hidden — a backgrounded
    // admin tab was happily firing 5 aggregations into the DB every 30s
    // forever. Also re-fetches on resume so the badge updates immediately
    // when the admin switches back.
    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (interval) return;
      loadStats();
      interval = setInterval(loadStats, ORDER_STATS_POLL_INTERVAL);
    };

    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
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

  const applyDateRange = (from: string, to: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set('dateFrom', from);
    else params.delete('dateFrom');
    if (to) params.set('dateTo', to);
    else params.delete('dateTo');
    params.set('page', '1');
    router.push(`/admin/orders?${params}`);
  };

  const setDatePreset = (preset: 'today' | 'week' | 'month' | 'clear') => {
    if (preset === 'clear') return applyDateRange('', '');
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    if (preset === 'today') return applyDateRange(iso(today), iso(today));
    const from = new Date(today);
    if (preset === 'week')
      from.setDate(today.getDate() - 6); // last 7 days inclusive
    else from.setDate(today.getDate() - 29); // last 30 days inclusive
    applyDateRange(iso(from), iso(today));
  };

  const handleQuickStatusInit = (orderId: number, newStatusVal: string) => {
    if (!newStatusVal) return;
    setConfirmStatusChange({ orderId, status: newStatusVal });
  };

  const handleQuickStatusConfirm = async () => {
    if (!confirmStatusChange) return;
    const { orderId, status: nextStatus } = confirmStatusChange;
    setQuickStatusUpdating(true);

    // Optimistic update — flip the badge immediately, revert if the server rejects.
    const prevOrders = orders;
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus as OrderStatus } : o)),
    );

    try {
      const res = await apiClient.put(`/api/v1/admin/orders/${orderId}/status`, {
        status: nextStatus,
      });
      if (res.success) {
        toast.success(t('statusChangedTo', { status: tl(`status.${nextStatus as OrderStatus}`) }));
        loadStats();
      } else {
        setOrders(prevOrders);
        toast.error(res.error || t('statusChangeError'));
      }
    } catch {
      setOrders(prevOrders);
      toast.error(t('networkRetry'));
    } finally {
      setConfirmStatusChange(null);
      setQuickStatusOrderId(null);
      setQuickStatusValue('');
      setQuickStatusUpdating(false);
    }
  };

  const handleExport = async () => {
    const params = new URLSearchParams({ type: 'orders', format: 'xlsx' });
    if (status) params.set('status', status);
    if (clientType) params.set('clientType', clientType);
    if (paymentMethod) params.set('paymentMethod', paymentMethod);
    if (paymentStatus) params.set('paymentStatus', paymentStatus);
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
        toast.error(t('exportError'));
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const filename =
        disposition?.match(/filename="(.+)"/)?.[1] ||
        `orders_${new Date().toISOString().slice(0, 10)}.xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t('exportDone'));
    } catch {
      toast.error(t('exportError'));
    }
  };

  const handleNewOrdersBadgeClick = () => {
    setNewOrdersBadge(0);
    // Sync the ref so the next poll doesn't re-resurrect the badge by
    // comparing against the stale "before-view" value.
    lastKnownNewRef.current = stats?.newOrders ?? 0;
    updateFilter('status', 'new_order');
  };

  // Auto-clear the badge once the admin is actually viewing the new-order
  // list — by then they've seen it, no point keeping the pulse going.
  useEffect(() => {
    if (status === 'new_order' && newOrdersBadge > 0) {
      setNewOrdersBadge(0);
      lastKnownNewRef.current = stats?.newOrders ?? 0;
    }
  }, [status, newOrdersBadge, stats?.newOrders]);

  // formatDateTime is the canonical Kyiv-timezone formatter — using local
  // toLocaleString here lost the timezone and drifted per server location.
  const formatDate = formatDateTime;

  const paymentStatusColor = (s: string) => {
    switch (s) {
      case 'paid':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'partial':
        return 'bg-blue-100 text-blue-700';
      case 'refunded':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold">{t('title')}</h2>
          {newOrdersBadge > 0 && (
            <button
              onClick={handleNewOrdersBadgeClick}
              className="animate-pulse rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white transition-transform hover:scale-110"
            >
              {t('newBadge', { count: newOrdersBadge })}
            </button>
          )}
          <SavedViews storageKey="orders" basePath="/admin/orders" />
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/orders/board"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-bg-secondary)]"
          >
            🗂️ {t('board')}
          </Link>
          <Button size="sm" variant="outline" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? t('hideFilters') : t('filters')}
            {hasFilters && !showFilters && (
              <span className="ml-1 inline-block h-2 w-2 rounded-full bg-[var(--color-primary)]" />
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            {t('export')}
          </Button>
          <button
            onClick={() => setHelpOpen(true)}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
            title={t('shortcutsTitle')}
          >
            <kbd className="font-mono">?</kbd>
          </button>
        </div>
      </div>
      <KeyboardShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />

      <OrdersAttentionPanel />

      {/* Stats cards */}
      {!stats ? (
        <AdminStatsSkeleton count={5} />
      ) : (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label={t('statNew')}
            value={stats.newOrders}
            color="text-blue-600"
            bg="bg-blue-50"
            onClick={handleNewOrdersBadgeClick}
          />
          <StatCard
            label={t('statProcessing')}
            value={stats.processingOrders}
            color="text-amber-600"
            bg="bg-amber-50"
            onClick={() => updateFilter('status', 'processing')}
          />
          <StatCard
            label={t('statUnpaid')}
            value={stats.unpaidOrders}
            color="text-red-600"
            bg="bg-red-50"
            onClick={() => updateFilter('paymentStatus', 'pending')}
          />
          <StatCard
            label={t('statTodayOrders')}
            value={stats.todayOrders}
            color="text-violet-600"
            bg="bg-violet-50"
            onClick={() => setDatePreset('today')}
          />
          <StatCard
            label={t('statTodayRevenue')}
            value={formatPrice(stats.todayRevenue)}
            color="text-emerald-600"
            bg="bg-emerald-50"
            onClick={() => setDatePreset('today')}
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
            placeholder={t('searchPh')}
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
            {t('resetFilters')}
          </button>
        )}
      </div>

      {/* Extended filters */}
      {showFilters && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              {t('filterStatus')}
            </label>
            <Select
              options={STATUS_OPTIONS}
              value={status}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              {t('filterClientType')}
            </label>
            <Select
              options={CLIENT_TYPE_OPTIONS}
              value={clientType}
              onChange={(e) => updateFilter('clientType', e.target.value)}
              className="w-32"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              {t('filterPayment')}
            </label>
            <Select
              options={PAYMENT_METHOD_OPTIONS}
              value={paymentMethod}
              onChange={(e) => updateFilter('paymentMethod', e.target.value)}
              className="w-48"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              {t('filterDelivery')}
            </label>
            <Select
              options={DELIVERY_METHOD_OPTIONS}
              value={deliveryMethod}
              onChange={(e) => updateFilter('deliveryMethod', e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              {t('dateFrom')}
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-[7px] text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              {t('dateTo')}
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-[7px] text-sm"
            />
          </div>
          <div className="flex w-full items-end gap-1 sm:w-auto">
            <DatePresetButton onClick={() => setDatePreset('today')} label={t('presetToday')} />
            <DatePresetButton onClick={() => setDatePreset('week')} label={t('presetWeek')} />
            <DatePresetButton onClick={() => setDatePreset('month')} label={t('presetMonth')} />
            <DatePresetButton
              onClick={() => setDatePreset('clear')}
              label={t('presetClear')}
              disabled={!dateFrom && !dateTo}
            />
          </div>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-4 py-2">
          <span className="text-sm">
            {t('selected')} <strong>{selectedIds.size}</strong>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={bulkStatus}
              onChange={(e) => {
                const next = e.target.value;
                setBulkStatus(next);
                if (next) setBulkStatusConfirm(next);
              }}
              disabled={isBulkStatusRunning || isBulkTtnRunning}
              options={[{ value: '', label: t('changeStatusTo') }, ...STATUS_OPTIONS.slice(1)]}
            />
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => setBulkTtnConfirm(true)}
                isLoading={isBulkTtnRunning}
                disabled={isBulkStatusRunning}
                title={t('createTtnNpTitle')}
              >
                {t('createTtnNp')}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedIds(new Set())}
              disabled={isBulkTtnRunning || isBulkStatusRunning}
            >
              {t('clearSelection')}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <AdminTableSkeleton rows={10} columns={8} />
      ) : (
        <>
          {/* Mobile card list (md:hidden) */}
          <div
            className={`space-y-2 md:hidden ${isRefreshing ? 'opacity-60' : ''}`}
            aria-busy={isRefreshing}
          >
            {orders.map((order) => (
              <Link
                key={`m-${order.id}`}
                href={`/admin/orders/${order.id}`}
                className="block rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-primary)]">
                    #{order.orderNumber}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{
                      backgroundColor: ORDER_STATUS_COLORS[order.status as OrderStatus],
                    }}
                  >
                    {tl(`status.${order.status as OrderStatus}`)}
                  </span>
                </div>
                <p className="text-sm">{order.contactName}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{order.contactPhone}</p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-[var(--color-text-secondary)]">
                    {formatDate(order.createdAt)}
                  </span>
                  <span className="font-bold text-sm">
                    {formatPrice(Number(order.totalAmount))}
                  </span>
                </div>
                {order.trackingNumber && (
                  <p className="mt-1 text-[11px] font-medium text-[var(--color-primary)]">
                    {t('ttnLabel', { ttn: order.trackingNumber })}
                  </p>
                )}
              </Link>
            ))}
            {orders.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] py-12 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                  <span className="text-2xl" aria-hidden="true">
                    📦
                  </span>
                </div>
                <p className="mb-1 text-sm font-semibold text-[var(--color-text)]">
                  {t('emptyTitle')}
                </p>
                <p className="mx-auto mb-4 max-w-xs text-xs text-[var(--color-text-secondary)]">
                  {t('emptyHintMobile')}
                </p>
              </div>
            )}
          </div>

          <div
            className={`hidden overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] transition-opacity md:block ${
              isRefreshing ? 'opacity-60' : ''
            }`}
            aria-busy={isRefreshing}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="w-10 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={orders.length > 0 && selectedIds.size === orders.length}
                      onChange={toggleSelectAll}
                      aria-label={t('selectAll')}
                    />
                  </th>
                  <th className="px-3 py-3 text-left font-medium">{t('thOrder')}</th>
                  <th className="px-3 py-3 text-left font-medium">{t('thClient')}</th>
                  <th className="px-3 py-3 text-left font-medium">{t('thStatus')}</th>
                  <th className="px-3 py-3 text-left font-medium">{t('thPayment')}</th>
                  <th className="px-3 py-3 text-left font-medium">{t('thDelivery')}</th>
                  <th className="px-3 py-3 text-right font-medium">{t('thAmount')}</th>
                  <th className="px-3 py-3 text-center font-medium w-10">{t('thActions')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, idx) => {
                  const transitions = ALLOWED_ORDER_TRANSITIONS[order.status] || [];

                  // Conditional formatting:
                  //  • red row → stuck new_order > 7 days (someone needs to act)
                  //  • amber row → shipped without tracking number (TTN missing)
                  //  • blue ring → currently focused via keyboard (j/k)
                  const ageDays = Math.floor(
                    (Date.now() - new Date(order.createdAt).getTime()) / 86_400_000,
                  );
                  const isStale = order.status === 'new_order' && ageDays > 7;
                  const isShippedNoTtn = order.status === 'shipped' && !order.trackingNumber;
                  const isFocused = idx === focusIndex;
                  const rowAccent = isStale
                    ? 'bg-red-50 hover:bg-red-100'
                    : isShippedNoTtn
                      ? 'bg-amber-50 hover:bg-amber-100'
                      : 'hover:bg-[var(--color-bg-secondary)]';
                  const focusRing = isFocused
                    ? 'outline outline-2 outline-[var(--color-primary)]'
                    : '';

                  return (
                    <tr
                      key={order.id}
                      className={`border-b border-[var(--color-border)] last:border-0 transition-colors ${rowAccent} ${focusRing}`}
                      title={
                        isStale
                          ? t('staleTitle', { days: ageDays })
                          : isShippedNoTtn
                            ? t('shippedNoTtnTitle')
                            : undefined
                      }
                    >
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(order.id)}
                          onChange={() => toggleSelected(order.id)}
                          aria-label={t('selectOrderAria', { n: order.orderNumber })}
                        />
                      </td>
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
                            {t('itemsCount', { count: order.itemsCount })}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-sm">{order.contactName}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {order.contactPhone}
                        </p>
                        {order.clientType === 'wholesale' && (
                          <span className="mt-0.5 inline-block rounded bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-primary)]">
                            {t('wholesale')}
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
                          {tl(`status.${order.status as OrderStatus}`)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                          {tl(`paymentMethod.${order.paymentMethod as PaymentMethod}`)}
                        </p>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${paymentStatusColor(order.paymentStatus)}`}
                        >
                          {tl(`paymentStatus.${order.paymentStatus as PaymentStatus}`)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-xs">
                          {tl(`deliveryMethod.${order.deliveryMethod as DeliveryMethod}`)}
                        </p>
                        {order.trackingNumber && (
                          <p className="mt-0.5 text-[11px] font-medium text-[var(--color-primary)]">
                            {t('ttnLabel', { ttn: order.trackingNumber })}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-bold">{formatPrice(Number(order.totalAmount))}</span>
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
                                  <option value="">{t('statusPlaceholder')}</option>
                                  {transitions.map((s) => (
                                    <option key={s} value={s}>
                                      {tl(`status.${s as OrderStatus}`)}
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
                                title={t('quickStatusTitle')}
                                className="rounded p-1 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-primary)]"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M12 20h9" />
                                  <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => setQuickEditId(order.id)}
                              title={t('quickEditTitle')}
                              className="rounded p-1 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-primary)]"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-[var(--color-text-secondary)]">
                        <span className="text-3xl" aria-hidden="true">
                          📦
                        </span>
                        <p className="text-sm font-medium">{t('emptyTitle')}</p>
                        {hasFilters ? (
                          <button
                            onClick={() => router.push('/admin/orders')}
                            className="text-xs text-[var(--color-primary)] hover:underline"
                          >
                            {t('resetAllFilters')}
                          </button>
                        ) : (
                          <p className="text-xs">{t('emptyHint')}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <p className="text-xs text-[var(--color-text-secondary)]">{t('total', { total })}</p>
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
        title={t('statusChangeTitle')}
        message={
          confirmStatusChange
            ? t('statusChangeMsg', {
                status: tl(`status.${confirmStatusChange.status as OrderStatus}`),
              })
            : ''
        }
        confirmText={t('confirmChange')}
        isLoading={quickStatusUpdating}
      />

      {/* Confirm bulk TTN creation */}
      <ConfirmDialog
        isOpen={bulkTtnConfirm}
        onClose={() => setBulkTtnConfirm(false)}
        onConfirm={handleBulkTtn}
        variant="warning"
        title={t('bulkTtnTitle')}
        message={t('bulkTtnMsg', { count: selectedIds.size })}
        confirmText={t('confirmCreate')}
        isLoading={isBulkTtnRunning}
      />

      {/* Confirm bulk status change */}
      <ConfirmDialog
        isOpen={!!bulkStatusConfirm}
        onClose={() => {
          setBulkStatusConfirm(null);
          setBulkStatus('');
        }}
        onConfirm={() => bulkStatusConfirm && handleBulkStatus(bulkStatusConfirm)}
        variant="warning"
        title={t('bulkStatusTitle')}
        message={
          bulkStatusConfirm
            ? t('bulkStatusMsg', {
                count: selectedIds.size,
                status: tl(`status.${bulkStatusConfirm as OrderStatus}`),
              })
            : ''
        }
        confirmText={t('confirmChange')}
        isLoading={isBulkStatusRunning}
      />

      {/* Quick edit drawer */}
      <OrderQuickEditDrawer
        orderId={quickEditId}
        onClose={() => setQuickEditId(null)}
        onUpdated={() => loadOrders()}
      />
    </div>
  );
}

function DatePresetButton({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-[7px] text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
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

/**
 * OrdersAttentionPanel — surfaces revenue-critical order states that would
 * otherwise sit hidden inside column filters. Same idea as the marketplace
 * AttentionPanel: zero counts collapse to a quiet "✓ Все ок" pill so the
 * operator learns to trust the absence of badges.
 */
function OrdersAttentionPanel() {
  const t = useTranslations('admin.ordersListPage');
  const router = useRouter();
  const [counts, setCounts] = useState<{
    withoutTtn24h: number;
    unpaid24h: number;
    stuckProcessing3d: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{
        withoutTtn24h: number;
        unpaid24h: number;
        stuckProcessing3d: number;
      }>('/api/v1/admin/orders/attention')
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setCounts(res.data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!counts) return null;
  const total = counts.withoutTtn24h + counts.unpaid24h + counts.stuckProcessing3d;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
        {t('needsAttention')}
      </span>
      {total === 0 ? (
        <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs text-green-700">
          {t('allOk')}
        </span>
      ) : (
        <>
          {counts.withoutTtn24h > 0 && (
            <AttentionOrderPill
              label={t('pillNoTtn')}
              count={counts.withoutTtn24h}
              tone="danger"
              onClick={() => {
                router.push('/admin/orders?status=confirmed&deliveryMethod=nova_poshta');
              }}
              title={t('pillNoTtnTitle')}
            />
          )}
          {counts.unpaid24h > 0 && (
            <AttentionOrderPill
              label={t('pillUnpaid')}
              count={counts.unpaid24h}
              tone="warn"
              onClick={() => {
                router.push('/admin/orders?paymentStatus=pending');
              }}
              title={t('pillUnpaidTitle')}
            />
          )}
          {counts.stuckProcessing3d > 0 && (
            <AttentionOrderPill
              label={t('pillStuck')}
              count={counts.stuckProcessing3d}
              tone="warn"
              onClick={() => {
                router.push('/admin/orders?status=processing');
              }}
              title={t('pillStuckTitle')}
            />
          )}
        </>
      )}
    </div>
  );
}

function AttentionOrderPill({
  label,
  count,
  tone,
  onClick,
  title,
}: {
  label: string;
  count: number;
  tone: 'danger' | 'warn';
  onClick: () => void;
  title?: string;
}) {
  const cls =
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
      : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100';
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${cls}`}
    >
      <span>{label}</span>
      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white/70 px-1 text-[10px] font-bold">
        {count > 99 ? '99+' : count}
      </span>
    </button>
  );
}
