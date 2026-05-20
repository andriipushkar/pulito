'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { formatPrice, todayKyiv, plural } from '@/utils/format';
import type { DashboardStats } from '@/types/user';
import Spinner from '@/components/ui/Spinner';
import ActivityFeed from '@/components/admin/ActivityFeed';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const DEFAULT_WIDGET_ORDER = [
  'stats',
  'recommendations',
  'weeklyRevenue',
  'hourlyToday',
  'recentOrders',
  'users',
  'products',
  'topProducts',
];

interface Recommendation {
  key: string;
  label: string;
  href: string;
  count: number;
  severity: 'info' | 'warning' | 'danger';
}

interface BackupStatus {
  hasBackup: boolean;
  latestAt: string | null;
  sizeBytes: number | null;
  ageHours: number | null;
  ageStatus: 'fresh' | 'stale' | 'missing';
}

interface DashboardLayout {
  widgetOrder: string[];
  hiddenWidgets: string[];
}

function SortableWidgetItem({
  id,
  label,
  isHidden,
  onToggle,
}: {
  id: string;
  label: string;
  isHidden: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between rounded-[var(--radius)] bg-[var(--color-bg-secondary)] px-3 py-2"
    >
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!isHidden}
          onChange={onToggle}
          className="accent-[var(--color-primary)]"
        />
        {label}
      </label>
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] active:cursor-grabbing"
        aria-label={`Перетягнути ${label}`}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
        </svg>
      </button>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<string[]>(DEFAULT_WIDGET_ORDER);
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<string>>(new Set());
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(30);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');

  const loadRecommendations = useCallback(() => {
    apiClient
      .get<Recommendation[]>('/api/v1/admin/dashboard/recommendations')
      .then((res) => {
        if (res.success && res.data) setRecommendations(res.data);
      })
      .catch((err) => {
        // Don't surface a toast for the recommendations card — it's a soft
        // signal and the rest of the dashboard should keep loading. Just log.
        console.warn('[Dashboard] loadRecommendations failed:', err);
      });
  }, []);

  const loadBackupStatus = useCallback(() => {
    apiClient
      .get<BackupStatus>('/api/v1/admin/dashboard/backup-status')
      .then((res) => {
        if (res.success && res.data) setBackupStatus(res.data);
      })
      .catch((err) => {
        console.warn('[Dashboard] loadBackupStatus failed:', err);
      });
  }, []);

  useEffect(() => {
    loadRecommendations();
    loadBackupStatus();
  }, [loadRecommendations, loadBackupStatus]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Reload via token bump; fetch lives in the effect so setState only
  // runs in the async callback.
  const [statsReloadToken, setStatsReloadToken] = useState(0);
  const loadStats = useCallback(() => {
    setIsRefreshing(true);
    setStatsReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<DashboardStats>('/api/v1/admin/dashboard/stats')
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setStats(res.data);
          setLastUpdated(new Date());
          setLoadError(null);
        } else {
          setLoadError(res.error || 'Не вдалося завантажити статистику');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Помилка мережі');
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
        setIsRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statsReloadToken]);

  // Load settings from server
  useEffect(() => {
    apiClient
      .get<{ layout?: DashboardLayout; refreshIntervalSeconds?: number }>(
        '/api/v1/admin/dashboard/settings',
      )
      .then((res) => {
        if (res.success && res.data) {
          const data = res.data;
          if (data.layout) {
            setWidgetOrder(data.layout.widgetOrder || DEFAULT_WIDGET_ORDER);
            setHiddenWidgets(new Set(data.layout.hiddenWidgets || []));
          }
          if (data.refreshIntervalSeconds) {
            setRefreshIntervalSeconds(data.refreshIntervalSeconds);
          }
        }
      })
      .finally(() => setSettingsLoaded(true));
  }, []);

  // Mount-time fetch is performed by the stats effect via initial token=0.
  // Only the auto-refresh interval needs to call loadStats() explicitly.
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadStats, refreshIntervalSeconds * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadStats, refreshIntervalSeconds]);

  useEffect(() => {
    const onNewOrder = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const orderNumber = detail?.latest?.orderNumber;
      const total = detail?.latest?.totalAmount;
      toast.success(
        orderNumber
          ? `Нове замовлення #${orderNumber}${total ? ` на ${total} грн` : ''}`
          : 'Нове замовлення',
        { duration: 6000 },
      );
      loadStats();
    };
    window.addEventListener('admin:new-order', onNewOrder);
    return () => window.removeEventListener('admin:new-order', onNewOrder);
  }, [loadStats]);

  const saveSettings = useCallback(async (order: string[], hidden: Set<string>) => {
    const res = await apiClient.put('/api/v1/admin/dashboard/settings', {
      layout: { widgetOrder: order, hiddenWidgets: [...hidden] },
    });
    if (!res.success) toast.error('Не вдалося зберегти налаштування');
  }, []);

  const toggleWidget = (key: string) => {
    setHiddenWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveSettings(widgetOrder, next);
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setWidgetOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      const next = arrayMove(prev, oldIndex, newIndex);
      saveSettings(next, hiddenWidgets);
      return next;
    });
  };

  const WIDGET_LABELS: Record<string, string> = {
    stats: 'Статистика',
    recommendations: 'Рекомендації',
    weeklyRevenue: 'Тижнева виручка',
    hourlyToday: 'Замовлення по годинах сьогодні',
    recentOrders: 'Останні замовлення',
    users: 'Користувачі',
    products: 'Товари',
    topProducts: 'Топ товарів',
  };

  if (isLoading || !settingsLoaded) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] py-12 text-center">
        <svg
          className="h-10 w-10 text-[var(--color-danger)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <p className="text-sm font-medium">Не вдалося завантажити статистику</p>
        {loadError && (
          <p className="text-xs text-[var(--color-text-secondary)]">{loadError}</p>
        )}
        <button
          onClick={loadStats}
          className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-dark)]"
        >
          Спробувати ще раз
        </button>
      </div>
    );
  }

  const revenueDiff = stats.orders.todayRevenue - stats.orders.yesterdayRevenue;
  const countDiff = stats.orders.todayCount - stats.orders.yesterdayCount;
  const todayKyivIso = todayKyiv().toISOString().slice(0, 10);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
              {isRefreshing && (
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-primary)]" />
              )}
              Оновлено: {lastUpdated.toLocaleTimeString('uk-UA')}
            </span>
          )}
          <RefreshControl
            isRefreshing={isRefreshing}
            autoRefresh={autoRefresh}
            intervalSeconds={refreshIntervalSeconds}
            onRefresh={loadStats}
            onToggleAuto={setAutoRefresh}
            onIntervalChange={setRefreshIntervalSeconds}
          />
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-bg-secondary)]"
          >
            {showConfig ? 'Готово' : 'Налаштувати'}
          </button>
        </div>
      </div>

      {showConfig && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">Налаштування віджетів</h3>
          <p className="mb-2 text-xs text-[var(--color-text-secondary)]">
            Перетягуйте віджети для зміни порядку
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={widgetOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {widgetOrder.map((key) => (
                  <SortableWidgetItem
                    key={key}
                    id={key}
                    label={WIDGET_LABELS[key]}
                    isHidden={hiddenWidgets.has(key)}
                    onToggle={() => toggleWidget(key)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Quick actions — data-driven: surface what actually needs attention.
          Falls back to static "create" shortcuts when nothing is pending. */}
      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {(() => {
          const actions: { href: string; icon: string; label: string; urgent?: boolean }[] = [];
          if (stats.orders.newCount > 0) {
            actions.push({
              href: '/admin/orders?status=new_order',
              icon: '📦',
              label: `Опрацювати ${stats.orders.newCount} ${plural(stats.orders.newCount, ['нове замовлення', 'нових замовлення', 'нових замовлень'])}`,
              urgent: true,
            });
          }
          if (stats.products.outOfStock > 0) {
            actions.push({
              href: '/admin/products?stock=out',
              icon: '🚨',
              label: `Поповнити ${stats.products.outOfStock} ${plural(stats.products.outOfStock, ['товар', 'товари', 'товарів'])}`,
              urgent: true,
            });
          }
          if (stats.products.lowStock > 0) {
            actions.push({
              href: '/admin/products?stock=low',
              icon: '⚠️',
              label: `Перевірити ${stats.products.lowStock} низькі залишки`,
              urgent: true,
            });
          }
          if (stats.users.pendingWholesale > 0) {
            actions.push({
              href: '/admin/users?wholesaleStatus=pending',
              icon: '🤝',
              label: `${stats.users.pendingWholesale} ${plural(stats.users.pendingWholesale, ['гуртовий запит', 'гуртових запити', 'гуртових запитів'])}`,
              urgent: true,
            });
          }
          // Fill remaining slots (up to 4) with static "create" actions
          const staticActions = [
            { href: '/admin/products/new', icon: '➕', label: 'Додати товар' },
            { href: '/admin/import', icon: '📥', label: 'Імпорт каталогу' },
            { href: '/admin/campaigns', icon: '📣', label: 'Створити кампанію' },
            { href: '/admin/users', icon: '👥', label: 'Користувачі' },
          ];
          while (actions.length < 4 && staticActions.length > 0) {
            actions.push(staticActions.shift()!);
          }
          return actions.slice(0, 4).map((a) => (
            <QuickAction
              key={a.href + a.label}
              href={a.href}
              icon={a.icon}
              label={a.label}
              color={a.urgent ? 'primary' : undefined}
            />
          ));
        })()}
      </div>

      {/* Alerts */}
      {(() => {
        const alerts: { text: string; href: string; type: 'danger' | 'warning' }[] = [];
        if (stats.orders.newCount > 0)
          alerts.push({
            text: `${stats.orders.newCount} ${plural(stats.orders.newCount, ['нове замовлення очікує', 'нових замовлення очікують', 'нових замовлень очікують'])} обробки`,
            href: '/admin/orders?status=new_order',
            type: 'warning',
          });
        if (stats.products.outOfStock > 0)
          alerts.push({
            text: `${stats.products.outOfStock} ${plural(stats.products.outOfStock, ['товар', 'товари', 'товарів'])} ${plural(stats.products.outOfStock, ['немає', 'немає', 'немає'])} в наявності`,
            href: '/admin/products?stock=out',
            type: 'danger',
          });
        if (stats.users.pendingWholesale > 0)
          alerts.push({
            text: `${stats.users.pendingWholesale} ${plural(stats.users.pendingWholesale, ['гуртовий запит очікує', 'гуртових запити очікують', 'гуртових запитів очікують'])} підтвердження`,
            href: '/admin/users?wholesaleStatus=pending',
            type: 'warning',
          });
        if (alerts.length === 0) return null;
        return (
          <div className="mb-6 space-y-2">
            {alerts.map((a, i) => (
              <Link
                key={i}
                href={a.href}
                className={`flex items-center gap-2 rounded-[var(--radius)] px-4 py-3 text-sm font-medium ${a.type === 'danger' ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${a.type === 'danger' ? 'bg-red-600' : 'bg-amber-500'}`}
                >
                  {a.type === 'danger' ? '✕' : '!'}
                </span>
                {a.text}
                <span className="ml-auto text-xs opacity-70">Переглянути →</span>
              </Link>
            ))}
          </div>
        );
      })()}

      {/* Onboarding checklist — appears only on a fresh shop with no orders yet,
          replaces the empty space when most widgets self-hide. weeklyRevenue
          always has 7 buckets (one per day) so we check total revenue instead. */}
      {stats.recentOrders.length === 0 &&
        stats.weeklyRevenue.every((d) => d.count === 0) && (
          <OnboardingChecklist hasProducts={stats.products.total > 0} />
        )}

      {/* Widgets rendered in user-configured order */}
      {widgetOrder.map((widgetKey) => {
        if (hiddenWidgets.has(widgetKey)) return null;

        if (widgetKey === 'stats') {
          // Aggregate window depending on selected date range.
          // Week/Month use the existing weeklyRevenue buckets (7 days),
          // so "month" effectively reuses the last 7 days until backend grows.
          const windowDays = dateRange === 'today' ? 1 : dateRange === 'week' ? 7 : 7;
          const buckets = stats.weeklyRevenue.slice(-windowDays);
          const periodCount =
            dateRange === 'today'
              ? stats.orders.todayCount
              : buckets.reduce((s, b) => s + b.count, 0);
          const periodRevenue =
            dateRange === 'today'
              ? stats.orders.todayRevenue
              : buckets.reduce((s, b) => s + b.revenue, 0);
          const periodLabel =
            dateRange === 'today' ? 'сьогодні' : dateRange === 'week' ? 'за тиждень' : 'за 30 днів';
          const periodDiff = dateRange === 'today' ? countDiff : undefined;
          const periodRevenueDiff = dateRange === 'today' ? revenueDiff : undefined;
          const ordersHref =
            dateRange === 'today'
              ? `/admin/orders?dateFrom=${todayKyivIso}`
              : `/admin/orders?dateFrom=${stats.weeklyRevenue[0]?.date || todayKyivIso}`;

          return (
            <div key="stats" className="mb-6">
              {/* Date-range switcher */}
              <div className="mb-3 inline-flex overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] text-xs font-medium">
                {(['today', 'week', 'month'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setDateRange(r)}
                    className={`px-3 py-1.5 transition-colors ${
                      dateRange === r
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                    }`}
                  >
                    {r === 'today' ? 'Сьогодні' : r === 'week' ? 'Тиждень' : 'Місяць'}
                  </button>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label={`Замовлення ${periodLabel}`}
                value={String(periodCount)}
                diff={periodDiff}
                href={ordersHref}
                trend={stats.weeklyRevenue.map((d) => d.count)}
              />
              <StatCard
                label={`Виручка ${periodLabel}`}
                value={formatPrice(periodRevenue)}
                diff={periodRevenueDiff}
                diffFormatter={(v) => formatPrice(v)}
                href={ordersHref}
                trend={stats.weeklyRevenue.map((d) => d.revenue)}
              />
              <StatCard
                label="Нові замовлення"
                value={String(stats.orders.newCount)}
                highlight={stats.orders.newCount > 0}
                href="/admin/orders?status=new_order"
              />
              <StatCard
                label="Гуртові запити"
                value={String(stats.users.pendingWholesale)}
                highlight={stats.users.pendingWholesale > 0}
                href="/admin/users?wholesaleStatus=pending"
              />
              </div>
            </div>
          );
        }

        if (widgetKey === 'users') {
          return (
            <div key="users" className="mb-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Користувачі
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniMetric label="Всього" value={stats.users.total} href="/admin/users" iconBg="bg-blue-50" iconColor="text-blue-600" iconPath="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                <MiniMetric label="Гуртівників" value={stats.users.wholesalers} href="/admin/users?role=wholesaler" iconBg="bg-emerald-50" iconColor="text-emerald-600" iconPath="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                <MiniMetric label="Нових за тиждень" value={stats.users.newThisWeek} iconBg="bg-amber-50" iconColor="text-amber-600" iconPath="M12 4.5v15m7.5-7.5h-15" />
              </div>
            </div>
          );
        }

        if (widgetKey === 'products') {
          return (
            <div key="products" className="mb-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Товари
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MiniMetric label="Активних" value={stats.products.total} href="/admin/products" iconBg="bg-indigo-50" iconColor="text-indigo-600" iconPath="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                <MiniMetric label="Закінчуються (≤5)" value={stats.products.lowStock} href="/admin/products?stock=low" tone={stats.products.lowStock > 0 ? 'warning' : undefined} iconBg="bg-amber-50" iconColor="text-amber-600" iconPath="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                <MiniMetric label="Немає на складі" value={stats.products.outOfStock} href="/admin/products?stock=out" tone={stats.products.outOfStock > 0 ? 'danger' : undefined} iconBg="bg-red-50" iconColor="text-red-600" iconPath="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <MiniMetric label="Без штрихкоду" value={stats.products.withoutBarcode ?? 0} href="/admin/products?missingBarcode=1" tone={(stats.products.withoutBarcode ?? 0) > 0 ? 'warning' : undefined} iconBg="bg-sky-50" iconColor="text-sky-600" iconPath="M3.75 4.875v14.25M6.75 4.875v14.25M10.5 4.875v14.25M14.25 4.875v14.25M17.25 4.875v14.25M20.25 4.875v14.25" />
              </div>
            </div>
          );
        }

        if (widgetKey === 'recentOrders' && stats.recentOrders.length > 0) {
          return (
            <div
              key="recentOrders"
              className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase text-[var(--color-text-secondary)]">
                  Останні замовлення
                </h3>
                <Link
                  href="/admin/orders"
                  className="text-xs font-medium text-[var(--color-primary)] hover:underline"
                >
                  Усі →
                </Link>
              </div>
              <div className="space-y-1">
                {stats.recentOrders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/admin/orders/${o.id}`}
                    className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-sm transition hover:bg-[var(--color-bg-secondary)]"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                        {o.orderNumber}
                      </span>{' '}
                      <span className="ml-1">{o.contactName}</span>
                    </span>
                    <span className="shrink-0 font-semibold">{formatPrice(o.totalAmount)}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        }

        if (widgetKey === 'recommendations') {
          // Build a combined list: backend recs + backup status (frontend-only).
          const combined = [...recommendations];
          if (backupStatus) {
            if (backupStatus.ageStatus === 'missing') {
              combined.unshift({
                key: 'backup_missing',
                label: 'Бекапів бази даних не знайдено',
                href: '/admin/audit-log',
                count: 0,
                severity: 'danger',
              });
            } else if (backupStatus.ageStatus === 'stale' && backupStatus.ageHours !== null) {
              combined.unshift({
                key: 'backup_stale',
                label: `Останній бекап ${Math.floor(backupStatus.ageHours / 24)} дн. тому — перевірте cron`,
                href: '/admin/audit-log',
                count: 0,
                severity: 'warning',
              });
            }
          }
          if (combined.length === 0) return null;
          const sevStyle = (sev: Recommendation['severity']) => {
            if (sev === 'danger') return 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100';
            if (sev === 'warning')
              return 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100';
            return 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg)]';
          };
          const sevIcon = (sev: Recommendation['severity']) =>
            sev === 'danger' ? '⚠️' : sev === 'warning' ? '⚡' : '💡';
          return (
            <div
              key="recommendations"
              className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5"
            >
              <h3 className="mb-3 text-sm font-semibold uppercase text-[var(--color-text-secondary)]">
                Рекомендації для магазину
              </h3>
              <ul className="space-y-2">
                {combined.map((r) => (
                  <li key={r.key}>
                    <Link
                      href={r.href}
                      className={`flex items-center gap-3 rounded-[var(--radius)] border px-3 py-2 text-sm transition-colors ${sevStyle(r.severity)}`}
                    >
                      <span aria-hidden="true">{sevIcon(r.severity)}</span>
                      <span className="flex-1">{r.label}</span>
                      <span className="text-xs opacity-70">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        if (widgetKey === 'hourlyToday' && stats.hourlyToday && stats.hourlyToday.length > 0) {
          const maxHour = Math.max(...stats.hourlyToday.map((h) => h.count), 1);
          const peak = stats.hourlyToday.reduce(
            (acc, h) => (h.count > acc.count ? h : acc),
            stats.hourlyToday[0],
          );
          const totalToday = stats.hourlyToday.reduce((s, h) => s + h.count, 0);
          return (
            <div
              key="hourlyToday"
              className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5"
            >
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold uppercase text-[var(--color-text-secondary)]">
                    Замовлення по годинах сьогодні
                  </h3>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Київський час · Усього: {totalToday}
                    {totalToday > 0 && (
                      <>
                        {' · '}
                        Пік:{' '}
                        <span className="font-semibold text-[var(--color-text)]">
                          {String(peak.hour).padStart(2, '0')}:00 ({peak.count})
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex h-28 items-end gap-0.5">
                {stats.hourlyToday.map((h) => {
                  const heightPct = (h.count / maxHour) * 100;
                  return (
                    <div
                      key={h.hour}
                      title={`${String(h.hour).padStart(2, '0')}:00 — ${h.count} замовл., ${formatPrice(h.revenue)}`}
                      className="group flex flex-1 flex-col items-center"
                    >
                      <div className="flex h-20 w-full items-end">
                        <div
                          className={`w-full rounded-t transition-colors ${
                            h.count > 0
                              ? 'bg-[var(--color-primary)] group-hover:bg-[var(--color-primary-dark)]'
                              : 'bg-[var(--color-border)]/40'
                          }`}
                          style={{ height: `${Math.max(heightPct, h.count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      <span
                        className={`mt-1 text-[9px] tabular-nums ${
                          h.hour % 3 === 0
                            ? 'text-[var(--color-text-secondary)]'
                            : 'text-transparent'
                        }`}
                      >
                        {String(h.hour).padStart(2, '0')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        if (widgetKey === 'weeklyRevenue' && stats.weeklyRevenue.length > 0) {
          const maxRevenue = Math.max(...stats.weeklyRevenue.map((d) => d.revenue), 1);
          const weekTotal = stats.weeklyRevenue.reduce((s, d) => s + d.revenue, 0);
          return (
            <div
              key="weeklyRevenue"
              className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5"
            >
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase text-[var(--color-text-secondary)]">
                    Виручка за тиждень
                  </h3>
                  <p className="mt-1 text-xl font-bold">{formatPrice(weekTotal)}</p>
                </div>
              </div>
              <div className="flex h-32 items-end gap-2">
                {stats.weeklyRevenue.map((d) => {
                  const heightPct = (d.revenue / maxRevenue) * 100;
                  const day = new Date(d.date);
                  const label = day.toLocaleDateString('uk-UA', {
                    weekday: 'short',
                  });
                  const isToday = d.date === todayKyivIso;
                  return (
                    <Link
                      key={d.date}
                      href={`/admin/orders?dateFrom=${d.date}&dateTo=${d.date}`}
                      title={`${d.date}: ${formatPrice(d.revenue)} (${d.count} замовл.)`}
                      className="group flex flex-1 flex-col items-center gap-1"
                    >
                      <div className="flex h-24 w-full items-end">
                        <div
                          className={`w-full rounded-t transition-colors ${isToday ? 'bg-[var(--color-primary)] group-hover:bg-[var(--color-primary-dark)]' : 'bg-[var(--color-border)] group-hover:bg-[var(--color-primary)]'}`}
                          style={{ height: `${Math.max(heightPct, 2)}%` }}
                        />
                      </div>
                      <span
                        className={`text-[10px] ${isToday ? 'font-bold' : 'text-[var(--color-text-secondary)]'}`}
                      >
                        {label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        }

        if (widgetKey === 'topProducts' && stats.topProducts.length > 0) {
          return (
            <div
              key="topProducts"
              className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5"
            >
              <h3 className="mb-4 text-sm font-semibold uppercase text-[var(--color-text-secondary)]">
                Топ-5 товарів за замовленнями (30 днів)
              </h3>
              <div className="space-y-1">
                {stats.topProducts.map((p, i) => {
                  const row = (
                    <div className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-sm transition hover:bg-[var(--color-bg-secondary)]">
                      <span className="min-w-0 truncate">
                        <span className="mr-2 text-[var(--color-text-secondary)]">{i + 1}.</span>
                        {p.name}
                      </span>
                      <span className="shrink-0 font-semibold">{p.quantity} шт</span>
                    </div>
                  );
                  return p.id ? (
                    <Link key={p.id} href={`/admin/products/${p.id}`}>
                      {row}
                    </Link>
                  ) : (
                    <div key={i}>{row}</div>
                  );
                })}
              </div>
            </div>
          );
        }

        return null;
      })}

      {/* Activity feed — live event stream. Not part of the user-orderable
          widget set because it makes more sense pinned to the bottom. */}
      <div className="mt-6">
        <ActivityFeed />
      </div>
    </div>
  );
}

function Sparkline({ values, color = 'currentColor' }: { values: number[]; color?: string }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const step = w / Math.max(values.length - 1, 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-[var(--color-primary)]" aria-hidden>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function StatCard({
  label,
  value,
  diff,
  diffFormatter,
  highlight,
  href,
  trend,
}: {
  label: string;
  value: string;
  diff?: number;
  diffFormatter?: (v: number) => string;
  highlight?: boolean;
  href?: string;
  trend?: number[];
}) {
  const content = (
    <div
      className={`rounded-[var(--radius)] border p-5 transition-colors ${
        highlight
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
          : 'border-[var(--color-border)] bg-[var(--color-bg)]'
      } ${href ? 'hover:border-[var(--color-primary)] hover:shadow-sm' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-[var(--color-text-secondary)]">{label}</p>
        {trend && trend.length > 1 && trend.some((v) => v > 0) && (
          <Sparkline values={trend} />
        )}
      </div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {diff !== undefined && (
        <p
          className={`mt-0.5 text-xs ${
            diff === 0
              ? 'text-[var(--color-text-secondary)]'
              : diff > 0
                ? 'text-green-600'
                : 'text-[var(--color-danger)]'
          }`}
        >
          {diff === 0 ? (
            <>— без змін vs вчора</>
          ) : (
            <>
              {diff > 0 ? '↑' : '↓'}{' '}
              {diffFormatter ? diffFormatter(Math.abs(diff)) : Math.abs(diff).toFixed(0)} vs вчора
            </>
          )}
        </p>
      )}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function QuickAction({
  href,
  icon,
  label,
  color,
}: {
  href: string;
  icon: string;
  label: string;
  color?: 'primary';
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-[var(--radius)] border px-4 py-3 text-sm font-medium transition-all hover:shadow-sm ${
        color === 'primary'
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]'
          : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)]'
      }`}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </Link>
  );
}

function OnboardingChecklist({ hasProducts }: { hasProducts: boolean }) {
  const steps = [
    {
      done: hasProducts,
      title: 'Додайте товари',
      description: 'Завантажте каталог через імпорт або створіть товари вручну',
      href: '/admin/products',
      cta: hasProducts ? 'Керувати товарами' : 'Додати перший товар',
    },
    {
      done: false,
      title: 'Налаштуйте оплату',
      description: 'Підключіть Monobank, LiqPay, Fondy або інші платіжки',
      href: '/admin/payment-settings',
      cta: 'Налаштувати',
    },
    {
      done: false,
      title: 'Налаштуйте доставку',
      description: 'Нова Пошта, Укрпошта, кур\'єр — встановіть зони і тарифи',
      href: '/admin/delivery-settings',
      cta: 'Налаштувати',
    },
    {
      done: false,
      title: 'Налаштуйте Email/SMTP',
      description: 'Без SMTP клієнти не отримають підтвердження замовлень',
      href: '/admin/smtp-settings',
      cta: 'Налаштувати',
    },
  ];
  const completed = steps.filter((s) => s.done).length;
  const percent = Math.round((completed / steps.length) * 100);

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-[var(--color-primary)]/20 bg-gradient-to-br from-[var(--color-primary)]/5 via-[var(--color-bg)] to-[var(--color-bg)] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--color-text)]">Перші кроки</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Завершіть налаштування магазину, щоб почати приймати замовлення
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-[var(--color-primary)]">{percent}%</p>
          <p className="text-[10px] text-[var(--color-text-secondary)]">
            {completed} з {steps.length}
          </p>
        </div>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {steps.map((s) => (
          <Link
            key={s.title}
            href={s.href}
            className={`group flex items-start gap-3 rounded-xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] p-3 transition-all hover:border-[var(--color-primary)] hover:shadow-sm ${
              s.done ? 'opacity-70' : ''
            }`}
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                s.done
                  ? 'bg-emerald-500 text-white'
                  : 'border-2 border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]'
              }`}
            >
              {s.done ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${s.done ? 'line-through' : 'text-[var(--color-text)]'}`}>
                {s.title}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{s.description}</p>
              {!s.done && (
                <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] group-hover:underline">
                  {s.cta} →
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function RefreshControl({
  isRefreshing,
  autoRefresh,
  intervalSeconds,
  onRefresh,
  onToggleAuto,
  onIntervalChange,
}: {
  isRefreshing: boolean;
  autoRefresh: boolean;
  intervalSeconds: number;
  onRefresh: () => void;
  onToggleAuto: (v: boolean) => void;
  onIntervalChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const INTERVALS = [
    { seconds: 30, label: '30 секунд' },
    { seconds: 60, label: '1 хвилина' },
    { seconds: 300, label: '5 хвилин' },
  ];
  return (
    <div className="relative inline-flex items-stretch overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] text-xs font-medium">
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-1.5 px-3 py-1.5 transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-60"
      >
        <svg
          className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
        {isRefreshing ? 'Оновлюємо…' : autoRefresh ? `Авто ${intervalSeconds}с` : 'Оновити'}
      </button>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="border-l border-[var(--color-border)] px-2 transition-colors hover:bg-[var(--color-bg-secondary)]"
        aria-label="Налаштування авто-оновлення"
        aria-expanded={open}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-md"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => {
              onToggleAuto(false);
              setOpen(false);
            }}
            className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-[var(--color-bg-secondary)] ${
              !autoRefresh ? 'font-semibold text-[var(--color-primary)]' : ''
            }`}
          >
            <span>Вимкнути</span>
            {!autoRefresh && <span aria-hidden>✓</span>}
          </button>
          <div className="border-t border-[var(--color-border)]" />
          {INTERVALS.map((opt) => {
            const active = autoRefresh && intervalSeconds === opt.seconds;
            return (
              <button
                key={opt.seconds}
                type="button"
                onClick={() => {
                  onIntervalChange(opt.seconds);
                  onToggleAuto(true);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-[var(--color-bg-secondary)] ${
                  active ? 'font-semibold text-[var(--color-primary)]' : ''
                }`}
              >
                <span>Авто кожні {opt.label}</span>
                {active && <span aria-hidden>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniMetric({
  label,
  value,
  href,
  tone,
  iconBg,
  iconColor,
  iconPath,
}: {
  label: string;
  value: number | string;
  href?: string;
  tone?: 'warning' | 'danger';
  iconBg: string;
  iconColor: string;
  iconPath: string;
}) {
  const valueClass =
    tone === 'danger'
      ? 'text-[var(--color-danger)]'
      : tone === 'warning'
        ? 'text-amber-600'
        : 'text-[var(--color-text)]';
  const content = (
    <div
      className={`flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 transition-all ${
        href ? 'hover:border-[var(--color-primary)] hover:shadow-sm' : ''
      }`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[var(--color-text-secondary)]">{label}</p>
        <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
