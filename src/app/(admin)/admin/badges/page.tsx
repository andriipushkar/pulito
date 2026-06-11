'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';
import { useDebounce } from '@/hooks/useDebounce';
import { SEARCH_DEBOUNCE_MS } from '@/config/admin-constants';
import { Check, Close } from '@/components/icons';

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
  const t = useTranslations('admin.badgesPage');
  const BADGE_TYPES = [
    { value: 'promo', label: t('typePromo') },
    { value: 'new_arrival', label: t('typeNewArrival') },
    { value: 'hit', label: t('typeHit') },
    { value: 'eco', label: t('typeEco') },
    { value: 'custom', label: t('typeCustom') },
  ];
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

  const loadBadges = useCallback(() => {
    apiClient
      .get<Badge[]>('/api/v1/admin/badges')
      .then((res) => {
        if (res.success && res.data) setBadges(res.data);
        else toast.error(res.error || t('loadError'));
      })
      .catch(() => toast.error(t('loadError')))
      .finally(() => setIsLoading(false));
  }, [t]);

  useEffect(() => {
    loadBadges();
  }, [loadBadges]);

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
      toast.error(t('selectProduct'));
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
      toast.success(t('createdToast'));
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
      toast.error(res.error || t('createError'));
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
    if (res.success) toast.success(t('updatedToast'));
    else toast.error(res.error || t('errorGeneric'));
    setEditingId(null);
    loadBadges();
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    const res = await apiClient.put(`/api/v1/admin/badges/${id}`, { isActive: !isActive });
    if (res.success) toast.success(isActive ? t('disabledToast') : t('enabledToast'));
    else toast.error(res.error || t('updateError'));
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
      toast.success(t('deletedToast'));
      setDeleteId(null);
      loadBadges();
    } else {
      toast.error(res.error || t('deleteError'));
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
          {t('title')}{' '}
          <span className="text-base font-normal text-[var(--color-text-secondary)]">
            ({badges.length})
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder={t('searchPh')}
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            className="w-72"
          />
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? t('cancel') : t('addBadge')}
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">{t('productLabel')}</label>
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
                  {t('changeBtn')}
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder={t('productSearchPh')}
                />
                {productQuery.length >= 2 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg">
                    {searchingProducts ? (
                      <div className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                        {t('searching')}
                      </div>
                    ) : productResults.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                        {t('nothingFound')}
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
              <label className="mb-1 block text-sm font-medium">{t('typeLabel')}</label>
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
              label={t('priorityLabel')}
              type="number"
              value={String(form.priority)}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
            />
          </div>
          {form.badgeType === 'custom' && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input
                label={t('textLabel')}
                value={form.customText}
                onChange={(e) => setForm({ ...form, customText: e.target.value })}
              />
              <div>
                <label className="mb-1 block text-sm font-medium">{t('colorLabel')}</label>
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
            <Button onClick={handleCreate}>{t('create')}</Button>
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
                    <label className="mb-1 block text-xs font-medium">{t('typeShortLabel')}</label>
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
                    <label className="mb-1 block text-xs font-medium">{t('priorityLabel')}</label>
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
                      <label className="mb-1 block text-xs font-medium">{t('colorLabel')}</label>
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
                    placeholder={t('textLabel')}
                    value={editForm.customText}
                    onChange={(e) => setEditForm({ ...editForm, customText: e.target.value })}
                    className="w-full rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                  />
                )}
                <div className="flex justify-end gap-2">
                  <button
                    aria-label={t('cancelEditAria')}
                    onClick={() => setEditingId(null)}
                    className="rounded-[var(--radius)] border border-[var(--color-border)] p-1.5"
                  >
                    <Close size={16} />
                  </button>
                  <button
                    aria-label={t('saveEditAria')}
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
                  {t('priorityPrefix', { value: b.priority })}
                </span>
                <button
                  onClick={() => startEdit(b)}
                  className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)]"
                >
                  {t('edit')}
                </button>
                <button
                  onClick={() => toggleActive(b.id, b.isActive)}
                  className={`rounded-full px-3 py-1 text-xs ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {b.isActive ? t('statusActive') : t('statusInactive')}
                </button>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  {t('delete')}
                </button>
              </div>
            )}
          </div>
        ))}
        {filteredBadges.length === 0 && badges.length > 0 && (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] py-8 text-center text-sm text-[var(--color-text-secondary)]">
            {t('emptySearch', { query: listSearch })}
          </div>
        )}
        {badges.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] py-12 text-center text-[var(--color-text-secondary)]">
            <span className="text-3xl" aria-hidden="true">
              🏷️
            </span>
            <p className="text-sm font-medium">{t('emptyTitle')}</p>
            <p className="max-w-md text-xs">{t('emptyHint')}</p>
            <button
              onClick={() => setShowForm(true)}
              className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-dark)]"
            >
              {t('addFirst')}
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        variant="danger"
        title={t('deleteTitle')}
        message={
          deleteTarget
            ? t('deleteMsg', {
                badge:
                  deleteTarget.customText ||
                  (BADGE_TYPES.find((bt) => bt.value === deleteTarget.badgeType)?.label ??
                    deleteTarget.badgeType),
                product: deleteTarget.product.name,
              })
            : t('deleteMsgGeneric')
        }
        confirmText={t('deleteConfirm')}
      />
    </div>
  );
}
