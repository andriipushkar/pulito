'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface Stats {
  totalActive: number;
  outOfStock: number;
  lowStock: number;
  lowStockThreshold: number;
}

/**
 * Compact inventory health widget for /admin/products. Three clickable cards:
 *   • Out of stock — filter to qty=0
 *   • Low stock (≤ threshold) — filter to a small range
 *   • Total active — clear stock filters
 *
 * The products API accepts `stock=in|low|out`, which maps directly to the
 * three cards below. Earlier this component sent `inStock=true|false` — a
 * parameter the API never read, so the cards were no-ops.
 */
export default function InventoryStatsWidget() {
  const t = useTranslations('admin.inventoryStatsWidget');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    apiClient
      .get<Stats>('/api/v1/admin/products/inventory-stats')
      .then((res) => {
        if (res.success && res.data) setStats(res.data);
      })
      .catch(() => {});
  }, []);

  if (!stats) return null;

  const setFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) params.delete(key);
    else params.set(key, value);
    params.delete('page');
    router.push(`/admin/products?${params.toString()}`);
  };

  const cards = [
    {
      label: t('active'),
      value: stats.totalActive,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      onClick: () => setFilter('stock', null),
    },
    {
      label: t('outOfStock'),
      value: stats.outOfStock,
      color: 'text-red-700',
      bg: 'bg-red-50',
      onClick: () => setFilter('stock', 'out'),
      hint: stats.outOfStock > 0 ? t('outOfStockHint') : null,
    },
    {
      label: t('lowStock', { threshold: stats.lowStockThreshold }),
      value: stats.lowStock,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      onClick: () => setFilter('stock', 'low'),
      hint: stats.lowStock > 0 ? t('lowStockHint') : null,
    },
  ];

  return (
    <div className="mb-4 grid grid-cols-3 gap-3">
      {cards.map((c) => (
        <button
          key={c.label}
          onClick={c.onClick}
          className={`rounded-xl ${c.bg} px-4 py-3 text-left transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.98]`}
          title={c.hint || undefined}
        >
          <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{c.label}</p>
        </button>
      ))}
    </div>
  );
}
