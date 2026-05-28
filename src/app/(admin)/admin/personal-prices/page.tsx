'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { formatPrice } from '@/utils/format';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';
import { useDebounce } from '@/hooks/useDebounce';
import { SEARCH_DEBOUNCE_MS } from '@/config/admin-constants';

interface PersonalPrice {
  id: number;
  userId: number;
  user: { id: number; fullName: string; email: string };
  productId: number | null;
  product: { id: number; name: string; code: string } | null;
  categoryId: number | null;
  discountPercent: number | null;
  fixedPrice: number | null;
  validFrom: string | null;
  validUntil: string | null;
  creator: { id: number; fullName: string };
  createdAt: string;
}

interface FormData {
  userId: string;
  productId: string;
  categoryId: string;
  discountPercent: string;
  fixedPrice: string;
  validFrom: string;
  validUntil: string;
}

interface UserOption {
  id: number;
  fullName: string;
  email: string;
}

interface ProductOption {
  id: number;
  name: string;
  code: string;
}

interface CategoryOption {
  id: number;
  name: string;
}

const emptyForm: FormData = {
  userId: '',
  productId: '',
  categoryId: '',
  discountPercent: '',
  fixedPrice: '',
  validFrom: '',
  validUntil: '',
};

export default function PersonalPricesPage() {
  const t = useTranslations('admin.personalPricesPage');
  const [items, setItems] = useState<PersonalPrice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // User picker
  const [pickedUser, setPickedUser] = useState<UserOption | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserOption[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const debouncedUserQuery = useDebounce(userQuery, SEARCH_DEBOUNCE_MS);

  // Product picker
  const [pickedProduct, setPickedProduct] = useState<ProductOption | null>(null);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const debouncedProductQuery = useDebounce(productQuery, SEARCH_DEBOUNCE_MS);

  // Categories (loaded once — small list)
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  useEffect(() => {
    apiClient.get<CategoryOption[]>('/api/v1/admin/categories').then((res) => {
      if (res.success && res.data) setCategories(res.data);
    });
  }, []);

  useEffect(() => {
    if (!debouncedUserQuery || debouncedUserQuery.length < 2) {
      setUserResults([]);
      return;
    }
    setSearchingUsers(true);
    apiClient
      .get<UserOption[]>(
        `/api/v1/admin/users?search=${encodeURIComponent(debouncedUserQuery)}&limit=10`,
      )
      .then((res) => {
        if (res.success && res.data) setUserResults(res.data);
      })
      .finally(() => setSearchingUsers(false));
  }, [debouncedUserQuery]);

  useEffect(() => {
    if (!debouncedProductQuery || debouncedProductQuery.length < 2) {
      setProductResults([]);
      return;
    }
    setSearchingProducts(true);
    apiClient
      .get<ProductOption[]>(
        `/api/v1/admin/products?search=${encodeURIComponent(debouncedProductQuery)}&limit=10`,
      )
      .then((res) => {
        if (res.success && res.data) setProductResults(res.data);
      })
      .finally(() => setSearchingProducts(false));
  }, [debouncedProductQuery]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<PersonalPrice[]>(
        `/api/v1/admin/personal-prices?page=${page}&limit=20`,
      );
      if (res.success && res.data) {
        setItems(res.data);
        setTotal((res as unknown as { pagination: { total: number } }).pagination?.total || 0);
      } else {
        toast.error(t('loadError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setForm(emptyForm);
    setPickedUser(null);
    setPickedProduct(null);
    setUserQuery('');
    setProductQuery('');
    setUserResults([]);
    setProductResults([]);
  };

  const handleSubmit = async () => {
    const userId = pickedUser?.id || (form.userId ? Number(form.userId) : 0);
    if (!userId) {
      toast.error(t('selectUser'));
      return;
    }
    const productId = pickedProduct?.id || (form.productId ? Number(form.productId) : 0);
    const categoryId = form.categoryId ? Number(form.categoryId) : 0;
    if (!productId && !categoryId) {
      toast.error(t('productOrCategory'));
      return;
    }
    if (productId && categoryId) {
      toast.error(t('notBoth'));
      return;
    }
    if (!form.discountPercent && !form.fixedPrice) {
      toast.error(t('discountOrFixed'));
      return;
    }
    if (form.discountPercent && form.fixedPrice) {
      toast.error(t('notBothDiscount'));
      return;
    }
    setIsSaving(true);
    const payload = {
      userId,
      productId: productId || undefined,
      categoryId: categoryId || undefined,
      discountPercent: form.discountPercent ? parseFloat(form.discountPercent) : undefined,
      fixedPrice: form.fixedPrice ? parseFloat(form.fixedPrice) : undefined,
      validFrom: form.validFrom || undefined,
      validUntil: form.validUntil || undefined,
    };

    try {
      const res = editingId
        ? await apiClient.put(`/api/v1/admin/personal-prices/${editingId}`, payload)
        : await apiClient.post('/api/v1/admin/personal-prices', payload);

      if (res.success) {
        toast.success(editingId ? t('updatedToast') : t('createdToast'));
        setShowModal(false);
        setEditingId(null);
        resetForm();
        fetchData();
      } else {
        toast.error(res.error || t('saveError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsSaving(false);
    }
  };

  const executeDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      const res = await apiClient.delete(`/api/v1/admin/personal-prices/${id}`);
      if (res.success) {
        toast.success(t('deletedToast'));
        fetchData();
      } else {
        toast.error(res.error || t('deleteError'));
      }
    } catch {
      toast.error(t('networkError'));
    }
  };

  const handleEdit = (item: PersonalPrice) => {
    setEditingId(item.id);
    setForm({
      userId: String(item.userId),
      productId: item.productId ? String(item.productId) : '',
      categoryId: item.categoryId ? String(item.categoryId) : '',
      discountPercent: item.discountPercent ? String(item.discountPercent) : '',
      fixedPrice: item.fixedPrice ? String(item.fixedPrice) : '',
      validFrom: item.validFrom?.slice(0, 10) || '',
      validUntil: item.validUntil?.slice(0, 10) || '',
    });
    setPickedUser({ id: item.user.id, fullName: item.user.fullName, email: item.user.email });
    setPickedProduct(
      item.product
        ? { id: item.product.id, name: item.product.name, code: item.product.code }
        : null,
    );
    setShowModal(true);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">
          {t('title')}{' '}
          <span className="text-base font-normal text-[var(--color-text-secondary)]">
            ({total})
          </span>
        </h2>
        <Button
          onClick={() => {
            resetForm();
            setEditingId(null);
            setShowModal(true);
          }}
        >
          {t('add')}
        </Button>
      </div>

      {isLoading ? (
        <AdminTableSkeleton rows={6} columns={6} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg-secondary)]">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">{t('colUser')}</th>
                  <th className="px-4 py-2 text-left font-medium">{t('colProductCategory')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('colDiscount')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('colFixedPrice')}</th>
                  <th className="px-4 py-2 text-left font-medium">{t('colTerm')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-secondary)]"
                  >
                    <td className="px-4 py-2">
                      <p className="text-xs font-medium">{item.user.fullName}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {item.user.email}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {item.product
                        ? `${item.product.name} (${item.product.code})`
                        : t('categoryPrefix', { id: item.categoryId ?? '' })}
                    </td>
                    <td className="px-4 py-2 text-right text-xs">
                      {item.discountPercent ? `${Number(item.discountPercent)}%` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-xs">
                      {item.fixedPrice ? formatPrice(Number(item.fixedPrice)) : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">
                      {item.validFrom ? new Date(item.validFrom).toLocaleDateString('uk-UA') : '∞'}{' '}
                      —{' '}
                      {item.validUntil
                        ? new Date(item.validUntil).toLocaleDateString('uk-UA')
                        : '∞'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleEdit(item)}
                        className="mr-2 text-xs text-[var(--color-primary)] hover:underline"
                      >
                        {t('editShort')}
                      </button>
                      <button
                        onClick={() => setDeleteId(item.id)}
                        className="text-xs text-[var(--color-danger)] hover:underline"
                      >
                        {t('deleteShort')}
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3 text-[var(--color-text-secondary)]">
                        <span className="text-3xl" aria-hidden="true">
                          💰
                        </span>
                        <p className="text-sm font-medium">{t('emptyTitle')}</p>
                        <p className="max-w-md text-xs">{t('emptyHint')}</p>
                        <button
                          onClick={() => {
                            resetForm();
                            setEditingId(null);
                            setShowModal(true);
                          }}
                          className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-dark)]"
                        >
                          {t('addFirst')}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {total > 20 && (
            <div className="mt-4 flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                {t('prev')}
              </Button>
              <span className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                {t('pageLabel', { page, total: Math.ceil(total / 20) })}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={items.length < 20}
              >
                {t('next')}
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        variant="danger"
        message={t('deleteMsg')}
      />

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingId(null);
        }}
        title={editingId ? t('editTitle') : t('addTitle')}
      >
        <div className="space-y-3 p-4">
          {/* User picker */}
          <div>
            <label className="mb-1 block text-sm font-medium">{t('userLabel')}</label>
            {pickedUser ? (
              <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm">
                <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                  #{pickedUser.id}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{pickedUser.fullName}</span>
                  <span className="block truncate text-xs text-[var(--color-text-secondary)]">
                    {pickedUser.email}
                  </span>
                </span>
                {!editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setPickedUser(null);
                      setUserQuery('');
                    }}
                    className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                  >
                    {t('changeBtn')}
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <Input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder={t('userSearchPh')}
                />
                {userQuery.length >= 2 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg">
                    {searchingUsers ? (
                      <div className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                        {t('searching')}
                      </div>
                    ) : userResults.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                        {t('nothingFound')}
                      </div>
                    ) : (
                      userResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setPickedUser(u);
                            setUserQuery('');
                            setUserResults([]);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-secondary)]"
                        >
                          <span className="block truncate">{u.fullName}</span>
                          <span className="block truncate text-xs text-[var(--color-text-secondary)]">
                            {u.email}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="rounded-[var(--radius)] bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
            {t('hint')}
          </p>

          {/* Product picker */}
          <div>
            <label className="mb-1 block text-sm font-medium">{t('productLabel')}</label>
            {pickedProduct ? (
              <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm">
                <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                  #{pickedProduct.id} · {pickedProduct.code}
                </span>
                <span className="flex-1 truncate">{pickedProduct.name}</span>
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
                  disabled={!!form.categoryId}
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
                            setForm((f) => ({ ...f, categoryId: '' }));
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

          {/* Category select */}
          <div>
            <label className="mb-1 block text-sm font-medium">{t('categoryLabel')}</label>
            <select
              value={form.categoryId}
              onChange={(e) => {
                const cat = e.target.value;
                setForm((f) => ({ ...f, categoryId: cat }));
                if (cat) {
                  setPickedProduct(null);
                  setProductQuery('');
                }
              }}
              disabled={!!pickedProduct}
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">{t('categoryNone')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label={t('discountLabel')}
            type="number"
            value={form.discountPercent}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                discountPercent: e.target.value,
                fixedPrice: e.target.value ? '' : f.fixedPrice,
              }))
            }
          />
          <Input
            label={t('fixedPriceLabel')}
            type="number"
            value={form.fixedPrice}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                fixedPrice: e.target.value,
                discountPercent: e.target.value ? '' : f.discountPercent,
              }))
            }
          />
          <Input
            label={t('validFromLabel')}
            type="date"
            value={form.validFrom}
            onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
          />
          <Input
            label={t('validUntilLabel')}
            type="date"
            value={form.validUntil}
            onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowModal(false);
                setEditingId(null);
              }}
            >
              {t('cancel')}
            </Button>
            <Button onClick={handleSubmit} isLoading={isSaving}>
              {editingId ? t('save') : t('create')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
