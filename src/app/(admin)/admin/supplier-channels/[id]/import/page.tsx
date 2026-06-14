'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';

interface ProductHit {
  id: number;
  code: string;
  name: string;
}

/** Inline product autocomplete: type a name/code → pick a product (sets its id),
 *  or just type a numeric id / exact code directly. */
function ProductPicker({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [results, setResults] = useState<ProductHit[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onType = (q: string) => {
    onChange(q);
    if (timer.current) clearTimeout(timer.current);
    // A bare id or short string isn't worth searching; ≥2 non-numeric chars are.
    if (q.trim().length < 2 || /^\d+$/.test(q.trim())) {
      setResults([]);
      setOpen(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    setOpen(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await apiClient.get<{ products: ProductHit[] }>(
          `/api/v1/admin/products?search=${encodeURIComponent(q.trim())}&limit=6`,
        );
        if (res.success && res.data) setResults(res.data.products);
        else setResults([]);
      } catch {
        setResults([]); // manual id/code entry still works
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onType(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="h-8 w-44 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-sm"
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-48 w-64 overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg">
          {searching && (
            <li className="px-2 py-1 text-xs text-[var(--color-text-secondary)]">Пошук…</li>
          )}
          {!searching && results.length === 0 && (
            <li className="px-2 py-1 text-xs text-[var(--color-text-secondary)]">
              Нічого не знайдено
            </li>
          )}
          {!searching &&
            results.map((r) => (
              <li
                key={r.id}
                onMouseDown={() => {
                  onChange(String(r.id));
                  setOpen(false);
                }}
                className="cursor-pointer px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)]"
              >
                <span className="font-mono">{r.code}</span> — {r.name}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

type Status = 'linked' | 'suggested' | 'unmatched';

interface PreviewItem {
  sku: string;
  name: string | null;
  barcode: string | null;
  purchasePrice: number | null;
  quantity: number;
  available: boolean;
  status: Status;
  linkedProductId: number | null;
  suggestion: { productId: number; code: string; name: string } | null;
}

interface Preview {
  channelId: number;
  total: number;
  linked: number;
  suggested: number;
  unmatched: number;
  items: PreviewItem[];
}

export default function SupplierFirstImportPage() {
  const params = useParams<{ id: string }>();
  const channelId = Number(params.id);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // sku → productId the admin wants to link (pre-filled from suggestions).
  const [picks, setPicks] = useState<Record<string, string>>({});
  // sku → whether to include this row when confirming (suggested rows pre-checked
  // so confirm links only what the admin actually selected, not every suggestion).
  const [apply, setApply] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<Preview>(
        `/api/v1/admin/supplier-channels/${channelId}/feed-preview`,
      );
      if (res.success && res.data) {
        setPreview(res.data);
        const initial: Record<string, string> = {};
        const initialApply: Record<string, boolean> = {};
        for (const it of res.data.items) {
          if (it.status === 'suggested' && it.suggestion) {
            initial[it.sku] = String(it.suggestion.productId);
            initialApply[it.sku] = true; // pre-check the suggested pair
          }
        }
        setPicks(initial);
        setApply(initialApply);
      } else {
        toast.error(res.error || 'Не вдалося завантажити фід');
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

  const confirm = async () => {
    // Each pick is either a numeric product id or a catalog code — send the
    // matching field so the admin can use whichever they have.
    type Link = { sku: string; productId?: number; productCode?: string };
    const links = Object.entries(picks)
      .map(([sku, ref]): Link | null => {
        const v = ref.trim();
        if (!v) return null;
        if (apply[sku] === false) return null; // row unchecked → skip
        return /^\d+$/.test(v) ? { sku, productId: Number(v) } : { sku, productCode: v };
      })
      .filter((l): l is Link => l !== null);
    if (links.length === 0) {
      toast.error('Позначте рядки для прив’язки (галочка «застосувати»)');
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.post<{ linked: number; skipped: { reason: string }[] }>(
        `/api/v1/admin/supplier-channels/${channelId}/link`,
        { links },
      );
      if (res.success && res.data) {
        toast.success(
          `Прив’язано: ${res.data.linked}${res.data.skipped.length ? `, пропущено: ${res.data.skipped.length}` : ''}`,
        );
        load();
      } else {
        toast.error(res.error || 'Не вдалося прив’язати');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setSaving(false);
    }
  };

  const unlink = async (productId: number) => {
    try {
      const res = await apiClient.post<{ unlinked: number }>(
        `/api/v1/admin/supplier-channels/${channelId}/unlink`,
        { productIds: [productId] },
      );
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

  const badge = (s: Status) => {
    const map: Record<Status, string> = {
      linked: 'bg-green-100 text-green-700',
      suggested: 'bg-blue-100 text-blue-700',
      unmatched: 'bg-gray-100 text-gray-500',
    };
    const label: Record<Status, string> = {
      linked: 'прив’язано',
      suggested: 'є пара',
      unmatched: 'без пари',
    };
    return <span className={`rounded-full px-2 py-0.5 text-xs ${map[s]}`}>{label[s]}</span>;
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Перший імпорт — прив’язка товарів</h1>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Канал #{channelId}. Підтверди, який товар сайту відповідає SKU постачальника. Далі синк
            оновлюватиме їх автоматично.
          </p>
        </div>
        <Link href="/admin/import" className="text-sm text-[var(--color-primary)] underline">
          ← До каналів
        </Link>
      </div>

      {loading && <div className="text-sm text-[var(--color-text-secondary)]">Завантаження…</div>}

      {!loading && preview && (
        <>
          <div className="mb-3 flex flex-wrap gap-4 text-sm">
            <span>Всього: {preview.total}</span>
            <span className="text-green-700">Прив’язано: {preview.linked}</span>
            <span className="text-blue-700">З парою: {preview.suggested}</span>
            <span className="text-gray-500">Без пари: {preview.unmatched}</span>
          </div>

          <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-2 py-2 text-center">✓</th>
                  <th className="px-2 py-2 text-left">SKU</th>
                  <th className="px-2 py-2 text-left">Назва у фіді</th>
                  <th className="px-2 py-2 text-right">Закуп.</th>
                  <th className="px-2 py-2 text-right">К-сть</th>
                  <th className="px-2 py-2 text-left">Статус</th>
                  <th className="px-2 py-2 text-left">Товар сайту</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-2 py-6 text-center text-[var(--color-text-secondary)]"
                    >
                      Фід порожній — немає рядків для прив’язки
                    </td>
                  </tr>
                )}
                {preview.items.map((it) => {
                  const hasPick = (picks[it.sku] ?? '').trim().length > 0;
                  return (
                    <tr
                      key={it.sku}
                      className="border-b border-[var(--color-border)] last:border-0"
                    >
                      <td className="px-2 py-2 text-center">
                        {it.status !== 'linked' && (
                          <input
                            type="checkbox"
                            checked={hasPick && apply[it.sku] !== false}
                            disabled={!hasPick}
                            onChange={(e) => setApply({ ...apply, [it.sku]: e.target.checked })}
                            title={hasPick ? 'Застосувати цей рядок' : 'Спершу вкажіть товар'}
                          />
                        )}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">{it.sku}</td>
                      <td className="px-2 py-2">{it.name ?? '—'}</td>
                      <td className="px-2 py-2 text-right">
                        {it.purchasePrice != null ? it.purchasePrice.toFixed(2) : '—'}
                      </td>
                      <td className="px-2 py-2 text-right">{it.quantity}</td>
                      <td className="px-2 py-2">{badge(it.status)}</td>
                      <td className="px-2 py-2">
                        {it.status === 'linked' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[var(--color-text-secondary)]">
                              #{it.linkedProductId}
                            </span>
                            <button
                              type="button"
                              onClick={() => it.linkedProductId && unlink(it.linkedProductId)}
                              className="text-xs text-red-600 underline"
                            >
                              відв’язати
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <ProductPicker
                              value={picks[it.sku] ?? ''}
                              onChange={(v) => {
                                setPicks({ ...picks, [it.sku]: v });
                                // Auto-check a row as soon as a product is chosen.
                                if (v.trim())
                                  setApply((a) => ({ ...a, [it.sku]: a[it.sku] ?? true }));
                              }}
                              placeholder={it.suggestion ? it.suggestion.code : 'ID, код або назва'}
                            />
                            {it.suggestion && (
                              <span className="text-xs text-blue-700">
                                пара: <span className="font-mono">{it.suggestion.code}</span> —{' '}
                                {it.suggestion.name}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={confirm} disabled={saving}>
              {saving ? 'Збереження…' : 'Підтвердити прив’язки'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
