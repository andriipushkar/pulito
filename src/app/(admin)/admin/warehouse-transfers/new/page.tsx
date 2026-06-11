'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useDebounce } from '@/hooks/useDebounce';

interface Warehouse {
  id: number;
  name: string;
  code: string;
  city: string;
}

interface ProductSuggestion {
  id: number;
  name: string;
  code: string;
  quantity: number;
}

interface TransferItemInput {
  productId: number;
  productName: string;
  productCode: string;
  quantity: number;
}

export default function NewTransferPage() {
  const router = useRouter();
  const t = useTranslations('admin.warehouseTransferNewPage');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [items, setItems] = useState<TransferItemInput[]>([]);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 250);

  useEffect(() => {
    apiClient.get<Warehouse[]>('/api/v1/admin/warehouses').then((res) => {
      if (res.success && res.data) setWarehouses(res.data);
    });
  }, []);

  // Skip the unconditional setSuggestions([]) — `visibleSuggestions` below
  // hides stale results when the query is short.
  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) return;
    let cancelled = false;
    apiClient
      // /admin/products uses the paginatedResponse envelope: res.data IS the
      // array (res.data.items was always undefined — suggestions never showed).
      .get<ProductSuggestion[]>(
        `/api/v1/admin/products?search=${encodeURIComponent(debouncedSearch)}&limit=10`,
      )
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setSuggestions(res.data);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const visibleSuggestions = !debouncedSearch || debouncedSearch.length < 2 ? [] : suggestions;

  const addItem = (p: ProductSuggestion) => {
    if (items.some((it) => it.productId === p.id)) return;
    setItems((prev) => [
      ...prev,
      { productId: p.id, productName: p.name, productCode: p.code, quantity: 1 },
    ]);
    setSearch('');
    setSuggestions([]);
  };

  const updateItemQty = (productId: number, quantity: number) => {
    setItems((prev) => prev.map((it) => (it.productId === productId ? { ...it, quantity } : it)));
  };

  const removeItem = (productId: number) => {
    setItems((prev) => prev.filter((it) => it.productId !== productId));
  };

  const submit = async () => {
    setError(null);
    if (!fromId || !toId || fromId === toId) {
      setError(t('errSameWarehouse'));
      return;
    }
    if (items.length === 0) {
      setError(t('errNoItems'));
      return;
    }
    setSubmitting(true);
    const res = await apiClient.post<{ id: number }>('/api/v1/admin/warehouse-transfers', {
      fromWarehouseId: fromId,
      toWarehouseId: toId,
      items: items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
      comment: comment.trim() || undefined,
    });
    setSubmitting(false);
    if (res.success && res.data) {
      router.push(`/admin/warehouse-transfers/${res.data.id}`);
    } else {
      setError(res.error || t('errCreate'));
    }
  };

  return (
    <div>
      <Link
        href="/admin/warehouse-transfers"
        className="text-sm text-[var(--color-primary)] hover:underline"
      >
        {t('backToList')}
      </Link>

      <h1 className="mt-4 mb-5 text-xl font-bold">{t('title')}</h1>

      {error && (
        <div className="mb-4 rounded-[var(--radius)] bg-red-50 p-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            {t('fromLabel')}
          </label>
          <select
            value={fromId ?? ''}
            onChange={(e) => setFromId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          >
            <option value="">{t('selectWarehouse')}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.city})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            {t('toLabel')}
          </label>
          <select
            value={toId ?? ''}
            onChange={(e) => setToId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          >
            <option value="">{t('selectWarehouse')}</option>
            {warehouses
              .filter((w) => w.id !== fromId)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.city})
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="mt-5">
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
          {t('addProduct')}
        </label>
        <div className="relative">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
          />
          {visibleSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg">
              {visibleSuggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => addItem(s)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-secondary)]"
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                      {s.code}
                    </span>{' '}
                    {s.name}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {t('stockLabel', { count: s.quantity })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-bg-secondary)]">
                <th className="px-3 py-2 text-left font-medium">{t('colProduct')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('colQty')}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.productId} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                      {item.productCode}
                    </span>{' '}
                    {item.productName}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItemQty(item.productId, Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-20 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-right text-sm tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="text-xs text-[var(--color-danger)] hover:underline"
                    >
                      {t('remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5">
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
          {t('commentLabel')}
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('commentPlaceholder')}
          rows={3}
          className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/admin/warehouse-transfers')}>
          {t('cancel')}
        </Button>
        <Button onClick={submit} isLoading={submitting}>
          {t('createDraft')}
        </Button>
      </div>
    </div>
  );
}
