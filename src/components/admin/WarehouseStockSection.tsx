'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

interface WarehouseRow {
  id: number;
  name: string;
  code: string;
  city: string;
  isDefault: boolean;
  quantity: number;
  reserved: number;
}

/**
 * Per-warehouse stock editor. Foundation only: the product's top-level
 * `quantity` column is still the source of truth for cart/checkout. This editor
 * lets the operator track per-warehouse availability so reports and 1C-sync
 * have real data when the multi-warehouse cart integration ships.
 */
export default function WarehouseStockSection({ productId }: { productId: number }) {
  const [rows, setRows] = useState<WarehouseRow[]>([]);
  const [pending, setPending] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = async () => {
    const res = await apiClient.get<WarehouseRow[]>(
      `/api/v1/admin/products/${productId}/warehouse-stock`,
    );
    if (res.success && res.data) setRows(res.data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const commit = async (warehouseId: number, raw: string) => {
    const next = Number(raw);
    const current = rows.find((r) => r.id === warehouseId);
    if (!current || !Number.isFinite(next) || next < 0 || next === current.quantity) {
      setPending((p) => {
        const c = { ...p };
        delete c[warehouseId];
        return c;
      });
      return;
    }
    const res = await apiClient.patch(
      `/api/v1/admin/products/${productId}/warehouse-stock`,
      { warehouseId, quantity: next },
    );
    if (res.success) {
      setRows((rs) => rs.map((r) => (r.id === warehouseId ? { ...r, quantity: next } : r)));
      toast.success(`${current.name}: ${next}`);
    } else {
      toast.error(res.error || 'Помилка');
    }
    setPending((p) => {
      const c = { ...p };
      delete c[warehouseId];
      return c;
    });
  };

  if (isLoading) {
    return (
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <p className="text-xs text-[var(--color-text-secondary)]">Завантаження складів…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return null;
  }

  const totalQty = rows.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Залишки по складах{' '}
          <span className="text-xs font-normal text-[var(--color-text-secondary)]">
            (foundation — не впливає на сайт)
          </span>
        </h3>
        <span className="text-xs text-[var(--color-text-secondary)]">
          Всього: <strong>{totalQty}</strong>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-[var(--color-text-secondary)]">
            <tr>
              <th className="px-2 py-1.5">Склад</th>
              <th className="px-2 py-1.5">Місто</th>
              <th className="px-2 py-1.5 text-right">Кількість</th>
              <th className="px-2 py-1.5 text-right">Резерв</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--color-border)]">
                <td className="px-2 py-1.5">
                  {r.name} {r.isDefault && <span className="text-[10px]">⭐</span>}
                </td>
                <td className="px-2 py-1.5 text-[var(--color-text-secondary)]">{r.city}</td>
                <td className="px-2 py-1.5 text-right">
                  <input
                    type="number"
                    value={pending[r.id] ?? String(r.quantity)}
                    onChange={(e) => setPending((p) => ({ ...p, [r.id]: e.target.value }))}
                    onBlur={(e) => commit(r.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                    }}
                    className="w-20 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-right"
                  />
                </td>
                <td className="px-2 py-1.5 text-right text-[var(--color-text-secondary)]">
                  {r.reserved}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
