'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';

interface DuplicatePair {
  a: {
    id: number;
    name: string;
    code: string;
    priceRetail: number;
    quantity: number;
  };
  b: {
    id: number;
    name: string;
    code: string;
    priceRetail: number;
    quantity: number;
  };
  similarity: number;
  reasons: string[];
}

export default function DuplicatesPage() {
  const [threshold, setThreshold] = useState(0.65);
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<DuplicatePair[]>(
        `/api/v1/admin/products/duplicates?threshold=${threshold}`,
      );
      if (res.success && res.data) {
        setPairs(res.data);
      } else {
        toast.error(res.error || 'Не вдалося завантажити дублікати');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold]);

  const visible = pairs.filter((p) => !dismissed.has(`${p.a.id}:${p.b.id}`));

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Дублікати товарів</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Алгоритм fuzzy-match. Перегляньте пари — можуть бути одним товаром під різними кодами.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-[var(--color-text-secondary)]">Поріг схожості:</span>
          <input
            type="range"
            min="0.5"
            max="0.95"
            step="0.05"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            aria-label={`Поріг схожості ${Math.round(threshold * 100)} відсотків`}
            aria-valuemin={50}
            aria-valuemax={95}
            aria-valuenow={Math.round(threshold * 100)}
            className="w-40"
          />
          <span className="font-mono tabular-nums">{Math.round(threshold * 100)}%</span>
        </label>
        <span className="text-xs text-[var(--color-text-secondary)]">
          Знайдено пар: <strong>{pairs.length}</strong>, прихованих: {dismissed.size}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-12 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Дублікатів за вибраним порогом не знайдено.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((pair) => {
            const key = `${pair.a.id}:${pair.b.id}`;
            return (
              <div
                key={key}
                className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-medium text-amber-700">
                      Схожість: {Math.round(pair.similarity * 100)}%
                    </span>
                    {pair.reasons.map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[var(--color-text-secondary)]"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDismissed((s) => {
                        const next = new Set(s);
                        next.add(key);
                        return next;
                      })
                    }
                    aria-label={`Сховати пару: "${pair.a.name}" та "${pair.b.name}" — не дублікати`}
                    className="text-xs text-[var(--color-text-secondary)] hover:underline"
                  >
                    Не дубль
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ProductPanel product={pair.a} />
                  <ProductPanel product={pair.b} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProductPanel({ product }: { product: DuplicatePair['a'] }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
      <Link
        href={`/admin/products/${product.id}`}
        className="text-sm font-medium text-[var(--color-primary)] hover:underline"
      >
        {product.name}
      </Link>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
        <span className="font-mono">{product.code}</span> · ID {product.id}
      </p>
      <div className="mt-2 flex items-center gap-3 text-xs">
        <span>
          <span className="text-[var(--color-text-secondary)]">Ціна:</span>{' '}
          <strong>{product.priceRetail.toFixed(0)} ₴</strong>
        </span>
        <span>
          <span className="text-[var(--color-text-secondary)]">Залишок:</span>{' '}
          <strong>{product.quantity}</strong>
        </span>
      </div>
    </div>
  );
}
