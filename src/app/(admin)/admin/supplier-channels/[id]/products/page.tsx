'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';

interface LinkedProduct {
  id: number;
  code: string;
  name: string;
  supplierSku: string | null;
  cost: number | null;
  priceRetail: number;
  quantity: number;
  allowBackorder: boolean;
  markupOverrideType: 'percent' | 'fixed' | null;
  markupOverrideValue: number | null;
}

type OverrideEdit = { type: '' | 'percent' | 'fixed'; value: string };

export default function LinkedProductsPage() {
  const params = useParams<{ id: string }>();
  const channelId = Number(params.id);
  const [rows, setRows] = useState<LinkedProduct[]>([]);
  const [edits, setEdits] = useState<Record<number, OverrideEdit>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<LinkedProduct[]>(
        `/api/v1/admin/supplier-channels/${channelId}/linked-products`,
      );
      if (res.success && res.data) {
        setRows(res.data);
        const e: Record<number, OverrideEdit> = {};
        for (const p of res.data) {
          e[p.id] = {
            type: p.markupOverrideType ?? '',
            value: p.markupOverrideValue != null ? String(p.markupOverrideValue) : '',
          };
        }
        setEdits(e);
      } else {
        toast.error(res.error || 'Не вдалося завантажити');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    if (!isNaN(channelId)) load();
  }, [channelId, load]);

  const saveOverride = async (productId: number) => {
    const e = edits[productId];
    const type = e.type === '' ? null : e.type;
    const value = type == null ? null : Number(e.value);
    if (type != null && (!Number.isFinite(value!) || value! < 0)) {
      toast.error('Вкажіть число ≥ 0');
      return;
    }
    try {
      const res = await apiClient.patch(
        `/api/v1/admin/supplier-channels/${channelId}/linked-products`,
        { productId, markupOverrideType: type, markupOverrideValue: value },
      );
      if (res.success) {
        toast.success('Збережено');
        load();
      } else {
        toast.error(res.error || 'Не вдалося зберегти');
      }
    } catch {
      toast.error('Помилка мережі');
    }
  };

  const unlink = async (productId: number) => {
    try {
      const res = await apiClient.post(`/api/v1/admin/supplier-channels/${channelId}/unlink`, {
        productIds: [productId],
      });
      if (res.success) {
        toast.success('Відв’язано');
        load();
      } else {
        toast.error(res.error || 'Не вдалося відв’язати');
      }
    } catch {
      toast.error('Помилка мережі');
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Прив’язані товари — канал #{channelId}</h1>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Товари, ціну й залишок яких веде цей постачальник. Тут можна задати індивідуальну
            націнку (перебиває базову на каналі) або відв’язати товар.
          </p>
        </div>
        <Link href="/admin/import" className="text-sm text-[var(--color-primary)] underline">
          ← До каналів
        </Link>
      </div>

      {loading && <div className="text-sm text-[var(--color-text-secondary)]">Завантаження…</div>}

      {!loading && (
        <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-2 py-2 text-left">Код</th>
                <th className="px-2 py-2 text-left">Назва</th>
                <th className="px-2 py-2 text-left">SKU пост.</th>
                <th className="px-2 py-2 text-right">Закуп.</th>
                <th className="px-2 py-2 text-right">Роздріб</th>
                <th className="px-2 py-2 text-right">Залиш.</th>
                <th className="px-2 py-2 text-left">Націнка (індивід.)</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-2 py-4 text-center text-[var(--color-text-secondary)]"
                  >
                    Жодного прив’язаного товару. Прив’яжи через «Перший імпорт».
                  </td>
                </tr>
              )}
              {rows.map((p) => {
                const e = edits[p.id] ?? { type: '', value: '' };
                return (
                  <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-2 py-2 font-mono text-xs">{p.code}</td>
                    <td className="px-2 py-2">
                      {p.name}
                      {p.allowBackorder && (
                        <span className="ml-1 rounded bg-blue-100 px-1 text-[10px] text-blue-700">
                          під замовлення
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">{p.supplierSku ?? '—'}</td>
                    <td className="px-2 py-2 text-right">
                      {p.cost != null ? p.cost.toFixed(2) : '—'}
                    </td>
                    <td className="px-2 py-2 text-right">{p.priceRetail.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{p.quantity}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <select
                          value={e.type}
                          onChange={(ev) =>
                            setEdits({
                              ...edits,
                              [p.id]: { ...e, type: ev.target.value as OverrideEdit['type'] },
                            })
                          }
                          className="h-8 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-1 text-xs"
                        >
                          <option value="">база каналу</option>
                          <option value="percent">%</option>
                          <option value="fixed">₴</option>
                        </select>
                        {e.type !== '' && (
                          <input
                            type="number"
                            value={e.value}
                            onChange={(ev) =>
                              setEdits({ ...edits, [p.id]: { ...e, value: ev.target.value } })
                            }
                            className="h-8 w-20 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-xs"
                          />
                        )}
                        <Button size="sm" variant="outline" onClick={() => saveOverride(p.id)}>
                          ✓
                        </Button>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => unlink(p.id)}
                        className="text-xs text-red-600 underline"
                      >
                        відв’язати
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
