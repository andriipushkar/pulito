'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useDebounce } from '@/hooks/useDebounce';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { SEARCH_DEBOUNCE_MS } from '@/config/admin-constants';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface BundleItem {
  productId: number;
  productName: string;
  productCode?: string;
  quantity: number;
}

interface BundleApiItem {
  productId: number;
  quantity: number;
  product?: { id: number; name: string; code: string };
}

interface BundleData {
  id: number;
  name: string;
  description: string | null;
  bundleType: 'curated' | 'custom';
  discountPercent: number | string;
  fixedPrice: number | string | null;
  isActive: boolean;
  items: BundleApiItem[];
}

interface ProductOption {
  id: number;
  name: string;
  code: string;
}

type Form = {
  name: string;
  description: string;
  bundleType: 'curated' | 'custom';
  discountPercent: number;
  fixedPrice: string;
  isActive: boolean;
};

const EMPTY_FORM: Form = {
  name: '',
  description: '',
  bundleType: 'curated',
  discountPercent: 0,
  fixedPrice: '',
  isActive: true,
};

export default function AdminBundleEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [items, setItems] = useState<BundleItem[]>([]);
  const [snapshot, setSnapshot] = useState<{ form: Form; items: BundleItem[] } | null>(null);

  // Product picker state — mirrors the pattern from /admin/badges so the
  // operator searches by name/code instead of memorising numeric IDs.
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [newQuantity, setNewQuantity] = useState('1');
  const debouncedQuery = useDebounce(productQuery, SEARCH_DEBOUNCE_MS);
  const [completedQuery, setCompletedQuery] = useState<string | null>(null);
  const searchingProducts =
    debouncedQuery.length >= 2 && completedQuery !== debouncedQuery;

  const isDirty = useMemo(() => {
    if (!snapshot) {
      // For new bundles, dirty as soon as the operator typed anything.
      return (
        form.name !== EMPTY_FORM.name ||
        form.description !== EMPTY_FORM.description ||
        form.bundleType !== EMPTY_FORM.bundleType ||
        form.discountPercent !== EMPTY_FORM.discountPercent ||
        form.fixedPrice !== EMPTY_FORM.fixedPrice ||
        form.isActive !== EMPTY_FORM.isActive ||
        items.length > 0
      );
    }
    return (
      JSON.stringify(form) !== JSON.stringify(snapshot.form) ||
      JSON.stringify(items) !== JSON.stringify(snapshot.items)
    );
  }, [form, items, snapshot]);

  const guardDirty = useUnsavedChangesGuard(isDirty);

  useEffect(() => {
    if (isNew) return;
    apiClient
      .get<BundleData>(`/api/v1/admin/bundles/${id}`)
      .then((res) => {
        if (res.success && res.data) {
          const d = res.data;
          const loadedForm: Form = {
            name: d.name,
            description: d.description || '',
            bundleType: d.bundleType,
            discountPercent: Number(d.discountPercent) || 0,
            fixedPrice: d.fixedPrice != null ? String(d.fixedPrice) : '',
            isActive: d.isActive,
          };
          const loadedItems: BundleItem[] = (d.items || []).map((i) => ({
            productId: i.productId,
            productName: i.product?.name || `Товар #${i.productId}`,
            productCode: i.product?.code,
            quantity: i.quantity,
          }));
          setForm(loadedForm);
          setItems(loadedItems);
          setSnapshot({ form: loadedForm, items: loadedItems });
        } else {
          toast.error(res.error || 'Не вдалося завантажити набір');
        }
      })
      .finally(() => setIsLoading(false));
  }, [id, isNew]);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return;
    let cancelled = false;
    apiClient
      .get<ProductOption[]>(
        `/api/v1/admin/products?search=${encodeURIComponent(debouncedQuery)}&limit=10`,
      )
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setProductResults(res.data);
      })
      .finally(() => {
        if (!cancelled) setCompletedQuery(debouncedQuery);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const addProduct = (product: ProductOption) => {
    if (items.some((i) => i.productId === product.id)) {
      toast.error('Товар вже додано');
      return;
    }
    const qty = Math.max(1, Number(newQuantity) || 1);
    setItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        quantity: qty,
      },
    ]);
    setProductQuery('');
    setProductResults([]);
    setCompletedQuery(null);
    setNewQuantity('1');
  };

  const removeItem = (productId: number) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const updateItemQty = (productId: number, quantity: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId ? { ...i, quantity: Math.max(1, quantity || 1) } : i,
      ),
    );
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Вкажіть назву набору';
    if (form.discountPercent < 0 || form.discountPercent > 100) {
      return 'Знижка має бути в межах 0–100%';
    }
    if (form.fixedPrice && Number(form.fixedPrice) < 0) {
      return 'Фіксована ціна не може бути від\'ємною';
    }
    if (items.length === 0) return 'Додайте хоча б один товар у набір';
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        bundleType: form.bundleType,
        discountPercent: form.discountPercent,
        fixedPrice: form.fixedPrice ? Number(form.fixedPrice) : null,
        isActive: form.isActive,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      };

      const res = isNew
        ? await apiClient.post<{ id: number }>('/api/v1/admin/bundles', payload)
        : await apiClient.patch(`/api/v1/admin/bundles/${id}`, payload);

      if (res.success) {
        toast.success(isNew ? 'Набір створено' : 'Збережено');
        setSnapshot({ form, items });
        if (isNew) router.push('/admin/bundles');
      } else {
        toast.error(res.error || 'Помилка збереження');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    setIsDeleting(true);
    try {
      const res = await apiClient.delete(`/api/v1/admin/bundles/${id}`);
      if (res.success) {
        toast.success('Набір видалено');
        // Skip the dirty-check on the way out — the resource no longer exists.
        setSnapshot({ form, items });
        router.push('/admin/bundles');
      } else {
        toast.error(res.error || 'Помилка видалення');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsDeleting(false);
    }
  };

  const goBack = () => guardDirty(() => router.push('/admin/bundles'));

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={goBack}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            ← Набори
          </button>
          <h2 className="mt-1 text-xl font-bold">{isNew ? 'Новий набір' : form.name}</h2>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="danger" onClick={() => setConfirmDelete(true)} isLoading={isDeleting}>
              Видалити
            </Button>
          )}
          <Button onClick={handleSave} isLoading={isSaving}>
            Зберегти
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">Основне</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Назва *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <div>
              <label className="mb-1 block text-sm font-medium">Тип</label>
              <select
                value={form.bundleType}
                onChange={(e) =>
                  setForm({ ...form, bundleType: e.target.value as 'curated' | 'custom' })
                }
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                <option value="curated">Готовий набір</option>
                <option value="custom">Довільний набір</option>
              </select>
            </div>
            <Input
              label="Знижка (%)"
              type="number"
              min="0"
              max="100"
              value={String(form.discountPercent)}
              onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })}
            />
            <Input
              label="Фіксована ціна (грн)"
              value={form.fixedPrice}
              onChange={(e) => setForm({ ...form, fixedPrice: e.target.value })}
              placeholder="Залишити пустим для знижки"
            />
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">Опис</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div className="mt-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="accent-[var(--color-primary)]"
              />
              Активний
            </label>
          </div>
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">Товари в наборі</h3>

          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="relative w-full max-w-sm">
              <label className="mb-1 block text-sm font-medium">Додати товар</label>
              <Input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Пошук за назвою або кодом…"
              />
              {productQuery.length >= 2 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg">
                  {searchingProducts ? (
                    <div className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                      Пошук…
                    </div>
                  ) : productResults.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                      Нічого не знайдено
                    </div>
                  ) : (
                    productResults.map((p) => {
                      const alreadyAdded = items.some((i) => i.productId === p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => addProduct(p)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                            {p.code}
                          </span>
                          <span className="flex-1 truncate">{p.name}</span>
                          {alreadyAdded && (
                            <span className="text-[10px] text-[var(--color-text-secondary)]">
                              вже у наборі
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <Input
              label="Кількість"
              type="number"
              min="1"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              className="w-28"
            />
          </div>

          {items.length > 0 ? (
            <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    <th className="px-4 py-2 text-left font-medium">Код</th>
                    <th className="px-4 py-2 text-left font-medium">Назва</th>
                    <th className="px-4 py-2 text-right font-medium">Кількість</th>
                    <th className="px-4 py-2 text-right font-medium">Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.productId}
                      className="border-b border-[var(--color-border)] last:border-0"
                    >
                      <td className="px-4 py-2 font-mono text-xs text-[var(--color-text-secondary)]">
                        {item.productCode || `#${item.productId}`}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/admin/products/${item.productId}`}
                          className="text-[var(--color-primary)] hover:underline"
                        >
                          {item.productName}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItemQty(item.productId, Number(e.target.value))}
                          className="w-20 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          className="text-xs text-[var(--color-danger)] hover:underline"
                        >
                          Видалити
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">
              Товарів не додано
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        variant="danger"
        title="Видалення набору"
        message={`Видалити набір "${form.name}"? Дія незворотна.`}
        confirmText="Так, видалити"
      />
    </div>
  );
}
