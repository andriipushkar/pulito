'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

interface Variant {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  priceRetail: string | number | null;
  priceWholesale: string | number | null;
  quantity: number;
  options: Record<string, string> | null;
  isActive: boolean;
  weightGrams: number | null;
  cost: string | number | null;
}

interface NewVariant {
  sku: string;
  barcode: string;
  name: string;
  priceRetail: string;
  priceWholesale: string;
  quantity: string;
  optionsText: string;
  weightGrams: string;
  cost: string;
}

const EMPTY_NEW: NewVariant = {
  sku: '',
  barcode: '',
  name: '',
  priceRetail: '',
  priceWholesale: '',
  quantity: '0',
  optionsText: '',
  weightGrams: '',
  cost: '',
};

/**
 * CRUD for product variants. Storefront does NOT yet consume variants — this
 * section is foundation-only. Adding a variant won't change what customers see.
 */
export default function VariantsSection({ productId }: { productId: number }) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState<NewVariant>(EMPTY_NEW);

  const fetchAll = async () => {
    const res = await apiClient.get<Variant[]>(`/api/v1/admin/products/${productId}/variants`);
    if (res.success && res.data) setVariants(res.data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const parseOptions = (text: string): Record<string, string> | null => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    } catch {
      // Fall through to "key=value, key=value" parser — friendlier than JSON.
    }
    const result: Record<string, string> = {};
    for (const pair of trimmed.split(',')) {
      const [k, ...rest] = pair.split('=');
      if (k && rest.length > 0) result[k.trim()] = rest.join('=').trim();
    }
    return Object.keys(result).length > 0 ? result : null;
  };

  const create = async () => {
    if (!draft.sku.trim() || !draft.name.trim()) {
      toast.error('Заповніть SKU та назву');
      return;
    }
    const res = await apiClient.post<Variant>(
      `/api/v1/admin/products/${productId}/variants`,
      {
        sku: draft.sku,
        barcode: draft.barcode.replace(/\D/g, ''),
        name: draft.name,
        priceRetail: draft.priceRetail || null,
        priceWholesale: draft.priceWholesale || null,
        quantity: Number(draft.quantity) || 0,
        options: parseOptions(draft.optionsText),
        weightGrams: draft.weightGrams ? Number(draft.weightGrams) : null,
        cost: draft.cost ? Number(draft.cost) : null,
      },
    );
    if (res.success) {
      toast.success('Варіант додано');
      setDraft(EMPTY_NEW);
      fetchAll();
    } else {
      toast.error(res.error || 'Помилка');
    }
  };

  const updateField = async (id: number, field: keyof Variant, value: unknown) => {
    const res = await apiClient.patch(
      `/api/v1/admin/products/${productId}/variants/${id}`,
      { [field]: value },
    );
    if (res.success) {
      fetchAll();
    } else {
      toast.error(res.error || 'Помилка');
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Видалити варіант?')) return;
    const res = await apiClient.delete(`/api/v1/admin/products/${productId}/variants/${id}`);
    if (res.success) {
      setVariants((vs) => vs.filter((v) => v.id !== id));
    } else {
      toast.error(res.error || 'Помилка');
    }
  };

  return (
    <details className="mb-6 rounded-[var(--radius)] border border-amber-200 bg-amber-50/30 p-4 [&[open]>summary>svg]:rotate-180">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">
            Варіанти товара{' '}
            <span className="text-xs font-normal text-[var(--color-text-secondary)]">
              (розмір / колір / смак)
            </span>
          </h3>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
            Beta
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-amber-700">
            ⚠️ Публічний сайт ще не показує варіанти
          </span>
          <svg className="h-4 w-4 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </summary>
      <div className="mt-4">

      {isLoading ? (
        <p className="py-4 text-center text-xs text-[var(--color-text-secondary)]">
          Завантаження…
        </p>
      ) : variants.length === 0 ? (
        <p className="py-4 text-center text-xs text-[var(--color-text-secondary)]">
          Немає варіантів. Створіть нижче.
        </p>
      ) : (
        <div className="mb-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-2 py-1.5">SKU</th>
                <th className="px-2 py-1.5">Назва</th>
                <th className="px-2 py-1.5 text-right">Ціна</th>
                <th className="px-2 py-1.5 text-right">К-сть</th>
                <th className="px-2 py-1.5">Опції</th>
                <th className="px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} className="border-t border-[var(--color-border)]">
                  <td className="px-2 py-1.5 font-mono">
                    <div>{v.sku}</div>
                    {v.barcode && (
                      <div className="text-[10px] text-[var(--color-text-tertiary)]">
                        {v.barcode}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5">{v.name}</td>
                  <td className="px-2 py-1.5 text-right">
                    {v.priceRetail !== null ? String(v.priceRetail) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <input
                      type="number"
                      defaultValue={v.quantity}
                      onBlur={(e) => {
                        const newQ = Number(e.target.value);
                        if (newQ !== v.quantity) updateField(v.id, 'quantity', newQ);
                      }}
                      className="w-16 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-0.5 text-right"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-[var(--color-text-secondary)]">
                    {v.options
                      ? Object.entries(v.options)
                          .map(([k, vv]) => `${k}: ${vv}`)
                          .join(', ')
                      : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      onClick={() => remove(v.id)}
                      className="rounded p-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-bg-secondary)]"
                      aria-label="Видалити"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-md border border-dashed border-[var(--color-border)] p-3">
        <p className="mb-2 text-xs font-semibold">Додати новий варіант</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="SKU"
            value={draft.sku}
            onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
          />
          <Input
            label="Штрихкод (опц.)"
            value={draft.barcode}
            onChange={(e) =>
              setDraft({ ...draft, barcode: e.target.value.replace(/\D/g, '').slice(0, 14) })
            }
            placeholder="4823033008007"
          />
          <Input
            label="Назва"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Input
            label="Ціна (опц.)"
            type="number"
            value={draft.priceRetail}
            onChange={(e) => setDraft({ ...draft, priceRetail: e.target.value })}
          />
          <Input
            label="К-сть"
            type="number"
            value={draft.quantity}
            onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
          />
          <Input
            label="Опції (color=red, size=M)"
            value={draft.optionsText}
            onChange={(e) => setDraft({ ...draft, optionsText: e.target.value })}
          />
          <Input
            label="Вага (г) — для TTN"
            type="number"
            value={draft.weightGrams}
            onChange={(e) => setDraft({ ...draft, weightGrams: e.target.value })}
            placeholder="300"
          />
          <Input
            label="Собівартість (₴) — для маржі"
            type="number"
            step="0.01"
            value={draft.cost}
            onChange={(e) => setDraft({ ...draft, cost: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <Button size="sm" className="mt-3" onClick={create}>
          + Додати варіант
        </Button>
      </div>
      </div>
    </details>
  );
}
