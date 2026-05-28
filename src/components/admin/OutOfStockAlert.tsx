'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';

interface OrderItem {
  productId: number;
  productCode: string;
  productName: string;
  quantity: number;
}

interface StockInfo {
  productId: number;
  available: number;
}

/**
 * OutOfStockAlert — checks current stock for every line item in the order
 * and warns the manager if anything ran out (or partially) since the order
 * was placed. Prevents the "I packed it then realized we don't have it"
 * scenario after promotions or stock corrections.
 */
export default function OutOfStockAlert({ items }: { items: OrderItem[] }) {
  const t = useTranslations('admin.outOfStockAlert');
  const [shortages, setShortages] = useState<Array<{ item: OrderItem; available: number }>>([]);
  const [checked, setChecked] = useState(false);

  // Stable signature: parent components pass a fresh `items` array literal on
  // every render. Without this memo, the effect below re-fires per render and
  // hammers /api/v1/products/by-ids in a hot loop.
  const itemsKey = useMemo(
    () => items.map((i) => `${i.productId}:${i.quantity}`).join('|'),
    [items],
  );

  useEffect(() => {
    if (items.length === 0) {
      setChecked(true);
      return;
    }
    let cancelled = false;
    apiClient
      .post<StockInfo[]>('/api/v1/products/by-ids', {
        ids: items.map((i) => i.productId),
        fields: ['quantity'],
      })
      .then((res) => {
        if (cancelled) return;
        // Either { id, quantity } or { productId, available }. Tolerate both.
        type Raw = { id?: number; productId?: number; quantity?: number; available?: number };
        const rows: Raw[] = (res.data as unknown as Raw[]) ?? [];
        const stockMap = new Map<number, number>();
        for (const r of rows) {
          const pid = r.productId ?? r.id;
          const qty = r.available ?? r.quantity;
          if (pid != null && qty != null) stockMap.set(pid, qty);
        }
        const found: Array<{ item: OrderItem; available: number }> = [];
        for (const it of items) {
          const avail = stockMap.get(it.productId) ?? 0;
          if (avail < it.quantity) found.push({ item: it, available: avail });
        }
        setShortages(found);
        setChecked(true);
      })
      .catch(() => setChecked(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  if (!checked || shortages.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm">
      <p className="mb-1 font-semibold text-red-800">{t('heading', { count: shortages.length })}</p>
      <ul className="space-y-0.5 text-xs text-red-700">
        {shortages.map(({ item, available }) => (
          <li key={item.productId}>
            <strong>{item.productName}</strong> ({item.productCode}) — {t('ordered')}{' '}
            <strong>{item.quantity}</strong>, {t('inStock')} <strong>{available}</strong>
            {available === 0 ? t('noneAtAll') : t('short', { count: item.quantity - available })}
          </li>
        ))}
      </ul>
    </div>
  );
}
