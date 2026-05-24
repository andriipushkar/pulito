'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';
import { useDebounce } from '@/hooks/useDebounce';
import { SEARCH_DEBOUNCE_MS } from '@/config/admin-constants';
import { Check, Close } from '@/components/icons';

const BADGE_TYPES = [
  { value: 'promo', label: 'Акція' },
  { value: 'new_arrival', label: 'Новинка' },
  { value: 'hit', label: 'Хіт' },
  { value: 'eco', label: 'Еко' },
  { value: 'custom', label: 'Інший' },
];

interface Badge {
  id: number;
  productId: number;
  badgeType: string;
  customText: string | null;
  customColor: string | null;
  priority: number;
  isActive: boolean;
  product: { id: number; name: string; code: string };
}

interface EditForm {
  badgeType: string;
  customText: string;
  customColor: string;
  priority: number;
}

interface ProductOption {
  id: number;
  name: string;
  code: string;
}

export default function AdminBadgesPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    productId: '',
    badgeType: 'promo',
    customText: '',
    customColor: '#2563eb',
    priority: 0,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    badgeType: 'promo',
    customText: '',
    customColor: '#2563eb',
    priority: 0,
  });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [pickedProduct, setPickedProduct] = useState<ProductOption | null>(null);
  const debouncedProductQuery = useDebounce(productQuery, SEARCH_DEBOUNCE_MS);
  // Derive searchingProducts from "completed query !== current".
  const [completedProductQuery, setCompletedProductQuery] = useState<string | null>(null);
  const searchingProducts =
    debouncedProductQuery.length >= 2 && completedProductQuery !== debouncedProductQuery;

  const deleteTarget = badges.find((b) => b.id === deleteId) || null;
  const filteredBadges = (() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return badges;
    return badges.filter(
      (b) =>
        b.product.name.toLowerCase().includes(q) ||
        b.product.code.toLowerCase().includes(q) ||
        (b.customText || '').toLowerCase().includes(q) ||
        BADGE_TYPES.find((t) => t.value === b.badgeType)
          ?.label.toLowerCase()
          .includes(q),
    );
  })();

  const loadBadges = () => {
    apiClient
      .get<Badge[]>('/api/v1/admin/badges')
      .then((res) => {
        if (res.success && res.data) setBadges(res.data);
        else toast.error(res.error || 'Помилка завантаження бейджів');
      })
      .catch(() => toast.error('Помилка завантаження бейджів'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadBadges();
  }, []);

  // Render-time guard below (`productQuery.length >= 2`) means stale results
  // are never shown for short queries, so we can skip the unconditional clear.
  useEffect(() => {
    if (!debouncedProductQuery || debouncedProductQuery.length < 2) return;
    let cancelled = false;
    apiClient
      .get<ProductOption[]>(
        `/api/v1/admin/products?search=${encodeURIComponent(debouncedProductQuery)}&limit=10`,
      )
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setProductResults(res.data);
      })
      .finally(() => {
        if (!cancelled) setCompletedProductQuery(debouncedProductQuery);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedProductQuery]);

  const handleCreate = async () => {
    const productId = pickedProduct?.id || Number(form.productId);
    if (!productId || Number.isNaN(productId)) {
      toast.error('Оберіть товар');
      return;
    }
    const res = await apiClient.post('/api/v1/admin/badges', {
      productId,
      badgeType: form.badgeType,
      customText: form.badgeType === 'custom' ? form.customText : null,
      customColor: form.customColor || null,
      priority: form.priority,
    });
    if (res.success) {
      toast.success('Бейдж створено');
      setShowForm(false);
      setForm({
        productId: '',
        badgeType: 'promo',
        customText: '',
        customColor: '#2563eb',
        priority: 0,
      });
      setPickedProduct(null);
      setProductQuery('');
      loadBadges();
    } else {
      toast.error(res.error || 'Помилка створення');
    }
  };

  const startEdit = (b: Badge) => {
    setEditingId(b.id);
    setEditForm({
      badgeType: b.badgeType,
      customText: b.customText || '',
      customColor: b.customColor || '#2563eb',
      priority: b.priority,
    });
  };

  const saveEdit = async (id: number) => {
    const res = await apiClient.put(`/api/v1/admin/badges/${id}`, {
      badgeType: editForm.badgeType,
      customText: editForm.badgeType === 'custom' ? editForm.customText : null,
      customColor: editForm.customColor,
      priority: editForm.priority,
    });
    if (res.success) toast.success('Бейдж оновлено');
    else toast.error(res.error || 'Помилка');
    setEditingId(null);
    loadBadges();
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    const res = await apiClient.put(`/api/v1/admin/badges/${id}`, { isActive: !isActive });
    if (res.success) toast.success(isActive ? 'Бейдж вимкнено' : 'Бейдж увімкнено');
    else toast.error(res.error || 'Помилка оновлення');
    loadBadges();
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
  };

  const executeDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    const res = await apiClient.delete(`/api/v1/admin/badges/${id}`);
    if (res.success) {
      toast.success('Бейдж видалено');
      setDeleteId(null);
      loadBadges();
    } else {
      toast.error(res.error || 'Помилка видалення');
    }
  };

  const getBadgeLabel = (type: string) => BADGE_TYPES.find((t) => t.value === type)?.label || type;

  if (isLoading) {
    return <AdminTableSkeleton rows={5} columns={4} />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">
          Бейджі товарів{' '}
          <span className="text-base font-normal text-[var(--color-text-secondary)]">
            ({badges.length})
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Пошук за товаром, кодом або типом…"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            className="w-72"
          />
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Скасувати' : '+ Додати бейдж'}
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Товар</label>
            {pickedProduct ? (
              <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm">
                <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                  #{pickedProduct.id} · {pickedProduct.code}
                </span>
                <span className="flex-1">{pickedProduct.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setPickedProduct(null);
                    setProductQuery('');
                  }}
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                >
                  ✕ Змінити
                </button>
              </div>
            ) : (
              <div className="relative">
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
                      productResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setPickedProduct(p);
                            setProductQuery('');
                            setProductResults([]);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-secondary)]"
                        >
                          <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                            {p.code}
                          </span>
                          <span className="flex-1 truncate">{p.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Тип бейджа</label>
              <select
                value={form.badgeType}
                onChange={(e) => setForm({ ...form, badgeType: e.target.value })}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                {BADGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Пріоритет"
              type="number"
              value={String(form.priority)}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
            />
          </div>
          {form.badgeType === 'custom' && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input
                label="Текст бейджа"
                value={form.customText}
                onChange={(e) => setForm({ ...form, customText: e.target.value })}
              />
              <div>
                <label className="mb-1 block text-sm font-medium">Колір</label>
                <input
                  type="color"
                  value={form.customColor}
                  onChange={(e) => setForm({ ...form, customColor: e.target.value })}
                  className="h-10 w-full rounded"
                />
              </div>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button onClick={handleCreate}>Створити</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filteredBadges.map((b) => (
          <div
            key={b.id}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3"
          >
            {editingId === b.id ? (
              <div className="space-y-3">
                <div
                  className={`grid gap-3 ${editForm.badgeType === 'custom' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
                >
                  <div>
                    <label className="mb-1 block text-xs font-medium">Тип</label>
                    <select
                      value={editForm.badgeType}
                      onChange={(e) => setEditForm({ ...editForm, badgeType: e.target.value })}
                      className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
                    >
                      {BADGE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Пріоритет</label>
                    <input
                      type="number"
                      value={editForm.priority}
                      onChange={(e) =>
                        setEditForm({ ...editForm, priority: Number(e.target.value) })
                      }
                      className="w-full rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                    />
                  </div>
                  {editForm.badgeType === 'custom' && (
                    <div>
                      <label className="mb-1 block text-xs font-medium">Колір</label>
                      <input
                        type="color"
                        value={editForm.customColor}
                        onChange={(e) => setEditForm({ ...editForm, customColor: e.target.value })}
                        className="h-8 w-full rounded"
                      />
                    </div>
                  )}
                </div>
                {editForm.badgeType === 'custom' && (
                  <input
                    placeholder="Текст бейджа"
                    value={editForm.customText}
                    onChange={(e) => setEditForm({ ...editForm, customText: e.target.value })}
                    className="w-full rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                  />
                )}
                <div className="flex justify-end gap-2">
                  <button
                    aria-label="Скасувати редагування"
                    onClick={() => setEditingId(null)}
                    className="rounded-[var(--radius)] border border-[var(--color-border)] p-1.5"
                  >
                    <Close size={16} />
                  </button>
                  <button
                    aria-label="Зберегти зміни"
                    onClick={() => saveEdit(b.id)}
                    className="rounded-[var(--radius)] bg-[var(--color-primary)] p-1.5 text-white"
                  >
                    <Check size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: b.customColor || '#2563eb' }}
                >
                  {b.customText || getBadgeLabel(b.badgeType)}
                </span>
                <span className="flex-1 text-sm">{b.product.name}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">{b.product.code}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Пріоритет: {b.priority}
                </span>
                <button
                  onClick={() => startEdit(b)}
                  className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)]"
                >
                  Редагувати
                </button>
                <button
                  onClick={() => toggleActive(b.id, b.isActive)}
                  className={`rounded-full px-3 py-1 text-xs ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {b.isActive ? 'Активний' : 'Вимкнено'}
                </button>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Видалити
                </button>
              </div>
            )}
          </div>
        ))}
        {filteredBadges.length === 0 && badges.length > 0 && (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] py-8 text-center text-sm text-[var(--color-text-secondary)]">
            За запитом «{listSearch}» нічого не знайдено
          </div>
        )}
        {badges.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] py-12 text-center text-[var(--color-text-secondary)]">
            <span className="text-3xl" aria-hidden="true">
              🏷️
            </span>
            <p className="text-sm font-medium">Бейджів ще немає</p>
            <p className="max-w-md text-xs">
              Бейджі привертають увагу до товару — «Акція», «Новинка», «Хіт» або власний текст
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-dark)]"
            >
              + Додати перший бейдж
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        variant="danger"
        title="Видалення бейджа"
        message={
          deleteTarget
            ? `Видалити бейдж «${deleteTarget.customText || (BADGE_TYPES.find((t) => t.value === deleteTarget.badgeType)?.label ?? deleteTarget.badgeType)}» для товару «${deleteTarget.product.name}»?`
            : 'Видалити бейдж?'
        }
        confirmText="Так, видалити"
      />
    </div>
  );
}
