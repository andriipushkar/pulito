'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import type { DashboardStats } from '@/types/user';
import Spinner from '@/components/ui/Spinner';
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

const DEFAULT_WIDGET_ORDER = ['stats', 'users', 'products', 'topProducts'];

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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

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
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
        </svg>
      </button>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<string[]>(DEFAULT_WIDGET_ORDER);
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<string>>(new Set());
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadStats = useCallback(() => {
    apiClient
      .get<DashboardStats>('/api/v1/admin/dashboard/stats')
      .then((res) => {
        if (res.success && res.data) {
          setStats(res.data);
          setLastUpdated(new Date());
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Load settings from server
  useEffect(() => {
    apiClient
      .get<{ layout?: DashboardLayout; refreshIntervalSeconds?: number }>('/api/v1/admin/dashboard/settings')
      .then((res) => {
        if (res.success && res.data) {
          const data = res.data;
          if (data.layout) {
            setWidgetOrder(data.layout.widgetOrder || DEFAULT_WIDGET_ORDER);
            setHiddenWidgets(new Set(data.layout.hiddenWidgets || []));
          }
        }
      })
      .finally(() => setSettingsLoaded(true));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadStats]);

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
    return <p className="text-[var(--color-text-secondary)]">Помилка завантаження даних</p>;
  }

  const revenueDiff = stats.orders.todayRevenue - stats.orders.yesterdayRevenue;
  const countDiff = stats.orders.todayCount - stats.orders.yesterdayCount;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Dashboard</h2>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-[var(--color-text-secondary)]">
              Оновлено: {lastUpdated.toLocaleTimeString('uk-UA')}
            </span>
          )}
          <button
            onClick={loadStats}
            className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-bg-secondary)]"
          >
            Оновити
          </button>
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-[var(--color-primary)]"
            />
            Авто (30с)
          </label>
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
          <p className="mb-2 text-xs text-[var(--color-text-secondary)]">Перетягуйте віджети для зміни порядку</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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

      {/* Alerts */}
      {(() => {
        const alerts: { text: string; href: string; type: 'danger' | 'warning' }[] = [];
        if (stats.orders.newCount > 0) alerts.push({ text: `${stats.orders.newCount} нових замовлень очікують обробки`, href: '/admin/orders?status=new_order', type: 'warning' });
        if (stats.products.outOfStock > 0) alerts.push({ text: `${stats.products.outOfStock} товарів немає в наявності`, href: '/admin/products?stock=out', type: 'danger' });
        if (stats.users.pendingWholesale > 0) alerts.push({ text: `${stats.users.pendingWholesale} оптових запитів очікують підтвердження`, href: '/admin/users?wholesaleStatus=pending', type: 'warning' });
        if (alerts.length === 0) return null;
        return (
          <div className="mb-6 space-y-2">
            {alerts.map((a, i) => (
              <Link key={i} href={a.href} className={`flex items-center gap-2 rounded-[var(--radius)] px-4 py-3 text-sm font-medium ${a.type === 'danger' ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>
                <span className="text-base">{a.type === 'danger' ? '!' : '!'}</span>
                {a.text}
                <span className="ml-auto text-xs opacity-70">Переглянути →</span>
              </Link>
            ))}
          </div>
        );
      })()}

      {/* Widgets rendered in user-configured order */}
      {widgetOrder.map((widgetKey) => {
        if (hiddenWidgets.has(widgetKey)) return null;

        if (widgetKey === 'stats') {
          return (
            <div key="stats" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Замовлення сьогодні" value={String(stats.orders.todayCount)} diff={countDiff} href="/admin/orders" />
              <StatCard label="Виручка сьогодні" value={`${stats.orders.todayRevenue.toFixed(0)} ₴`} diff={revenueDiff} diffSuffix=" ₴" />
              <StatCard label="Нові замовлення" value={String(stats.orders.newCount)} highlight={stats.orders.newCount > 0} href="/admin/orders?status=new_order" />
              <StatCard label="Оптові запити" value={String(stats.users.pendingWholesale)} highlight={stats.users.pendingWholesale > 0} href="/admin/users?wholesaleStatus=pending" />
            </div>
          );
        }

        if (widgetKey === 'users') {
          return (
            <div key="users" className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase text-[var(--color-text-secondary)]">Користувачі</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span>Всього зареєстрованих</span><span className="font-semibold">{stats.users.total}</span></div>
                <div className="flex justify-between text-sm"><span>Оптовиків</span><span className="font-semibold">{stats.users.wholesalers}</span></div>
                <div className="flex justify-between text-sm"><span>Нових за тиждень</span><span className="font-semibold">{stats.users.newThisWeek}</span></div>
              </div>
            </div>
          );
        }

        if (widgetKey === 'products') {
          return (
            <div key="products" className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase text-[var(--color-text-secondary)]">Товари</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span>Активних товарів</span><span className="font-semibold">{stats.products.total}</span></div>
                <div className="flex justify-between text-sm">
                  <span>Немає на складі</span>
                  <span className={`font-semibold ${stats.products.outOfStock > 0 ? 'text-[var(--color-danger)]' : ''}`}>{stats.products.outOfStock}</span>
                </div>
              </div>
            </div>
          );
        }

        if (widgetKey === 'topProducts' && stats.topProducts.length > 0) {
          return (
            <div key="topProducts" className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase text-[var(--color-text-secondary)]">Топ-5 товарів за замовленнями</h3>
              <div className="space-y-2">
                {stats.topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span><span className="mr-2 text-[var(--color-text-secondary)]">{i + 1}.</span>{p.name}</span>
                    <span className="font-semibold">{p.quantity} шт</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  diff,
  diffSuffix = '',
  highlight,
  href,
}: {
  label: string;
  value: string;
  diff?: number;
  diffSuffix?: string;
  highlight?: boolean;
  href?: string;
}) {
  const content = (
    <div
      className={`rounded-[var(--radius)] border p-5 ${
        highlight
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
          : 'border-[var(--color-border)] bg-[var(--color-bg)]'
      }`}
    >
      <p className="text-sm text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {diff !== undefined && (
        <p className={`mt-0.5 text-xs ${diff >= 0 ? 'text-green-600' : 'text-[var(--color-danger)]'}`}>
          {diff >= 0 ? '↑' : '↓'} {Math.abs(diff).toFixed(0)}{diffSuffix} vs вчора
        </p>
      )}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
