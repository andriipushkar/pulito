'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { apiClient } from '@/lib/api-client';

interface UserStats {
  totalOrders: number;
  totalSpent: number;
  lastOrderDays: number | null;
}

interface ProductStats {
  ordersCount: number;
  quantity: number;
  viewsCount: number;
}

type StatsFor = { type: 'user'; id: number } | { type: 'product'; id: number };

// In-memory cache so hovering the same item repeatedly doesn't refetch.
// Cleared on page navigation (component remount).
const userCache = new Map<number, UserStats>();
const productCache = new Map<number, ProductStats>();
const HOVER_DELAY_MS = 250;

export function HoverUserStats({ userId, children }: { userId: number; children: ReactNode }) {
  return (
    <HoverStatsBase target={{ type: 'user', id: userId }}>
      {children}
    </HoverStatsBase>
  );
}

export function HoverProductStats({
  productId,
  children,
}: {
  productId: number;
  children: ReactNode;
}) {
  return (
    <HoverStatsBase target={{ type: 'product', id: productId }}>
      {children}
    </HoverStatsBase>
  );
}

function HoverStatsBase({ target, children }: { target: StatsFor; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<UserStats | ProductStats | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStats = async () => {
    if (target.type === 'user') {
      const cached = userCache.get(target.id);
      if (cached) {
        setStats(cached);
        return;
      }
      const res = await apiClient.get<UserStats>(`/api/v1/admin/users/${target.id}/quick-stats`);
      if (res.success && res.data) {
        userCache.set(target.id, res.data);
        setStats(res.data);
      }
    } else {
      const cached = productCache.get(target.id);
      if (cached) {
        setStats(cached);
        return;
      }
      const res = await apiClient.get<ProductStats>(
        `/api/v1/admin/products/${target.id}/quick-stats`,
      );
      if (res.success && res.data) {
        productCache.set(target.id, res.data);
        setStats(res.data);
      }
    }
  };

  const handleEnter = () => {
    timer.current = setTimeout(() => {
      setOpen(true);
      fetchStats();
    }, HOVER_DELAY_MS);
  };

  const handleLeave = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <span
      className="relative inline-block"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {open && (
        <span className="pointer-events-none absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs shadow-lg">
          {stats === null ? (
            <span className="text-[var(--color-text-secondary)]">Завантаження…</span>
          ) : target.type === 'user' ? (
            <UserBody stats={stats as UserStats} />
          ) : (
            <ProductBody stats={stats as ProductStats} />
          )}
        </span>
      )}
    </span>
  );
}

function UserBody({ stats }: { stats: UserStats }) {
  return (
    <div className="space-y-1">
      <p>
        <strong>{stats.totalOrders}</strong> замовлень
      </p>
      <p>
        Витрачено: <strong>{stats.totalSpent.toFixed(0)} грн</strong>
      </p>
      <p className="text-[var(--color-text-secondary)]">
        {stats.lastOrderDays === null
          ? 'Ще не купував'
          : stats.lastOrderDays === 0
            ? 'Сьогодні'
            : `${stats.lastOrderDays} дн тому`}
      </p>
    </div>
  );
}

function ProductBody({ stats }: { stats: ProductStats }) {
  return (
    <div className="space-y-1">
      <p>
        Продано: <strong>{stats.ordersCount}</strong>
      </p>
      <p>
        Залишок: <strong>{stats.quantity}</strong>
      </p>
      <p className="text-[var(--color-text-secondary)]">Переглядів: {stats.viewsCount}</p>
    </div>
  );
}
