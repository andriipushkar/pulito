'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';
import PageSizeSelector from '@/components/admin/PageSizeSelector';
import { useDebounce } from '@/hooks/useDebounce';
import Image from 'next/image';
import { DEFAULT_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '@/config/admin-constants';

interface AdminProduct {
  id: number;
  code: string;
  name: string;
  slug: string;
  priceRetail: number;
  priceWholesale: number | null;
  quantity: number;
  isActive: boolean;
  isPromo: boolean;
  imagePath: string | null;
  ordersCount: number;
  sortOrder: number;
  category: { id: number; name: string } | null;
  brand: { id: number; name: string } | null;
}

interface CategoryOption {
  id: number;
  name: string;
}

interface BrandOption {
  id: number;
  name: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Всі статуси' },
  { value: 'true', label: 'Активні' },
  { value: 'false', label: 'Вимкнені' },
];

const STOCK_OPTIONS = [
  { value: '', label: 'Весь залишок' },
  { value: 'out', label: 'Немає (0)' },
  { value: 'low', label: 'Мало (1-5)' },
  { value: 'in', label: 'В наявності (>5)' },
];

const SORT_OPTIONS = [
  { value: 'id_desc', label: 'Нові спочатку' },
  { value: 'id_asc', label: 'Старі спочатку' },
  { value: 'name_asc', label: 'Назва А-Я' },
  { value: 'name_desc', label: 'Назва Я-А' },
  { value: 'price_asc', label: 'Ціна: дешеві' },
  { value: 'price_desc', label: 'Ціна: дорогі' },
  { value: 'quantity_asc', label: 'Залишок: мало' },
  { value: 'quantity_desc', label: 'Залишок: багато' },
  { value: 'sales_desc', label: 'За продажами' },
  { value: 'sort_order_asc', label: 'Порядок (зростання)' },
  { value: 'sort_order_desc', label: 'Порядок (спадання)' },
  { value: 'category_asc', label: 'Категорія А-Я' },
  { value: 'category_desc', label: 'Категорія Я-А' },
];

const BULK_ACTIONS = [
  { value: '', label: 'Масова дія...' },
  { value: 'activate', label: 'Активувати' },
  { value: 'deactivate', label: 'Деактивувати' },
  { value: 'delete', label: 'Видалити' },
  { value: 'change_category', label: 'Змінити категорію' },
  { value: 'change_brand', label: 'Змінити виробника' },
  { value: 'export', label: 'Експорт обраних (XLSX)' },
];

export default function AdminProductsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [bulkBrandId, setBulkBrandId] = useState('');
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [rowDelete, setRowDelete] = useState<AdminProduct | null>(null);
  const [isDeletingRow, setIsDeletingRow] = useState(false);
  const [pendingSortOrder, setPendingSortOrder] = useState<Record<number, string>>({});

  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || DEFAULT_PAGE_SIZE;

  // Debounced search
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);

  // Auto-search on debounced value change
  useEffect(() => {
    const currentSearch = searchParams.get('search') || '';
    if (debouncedSearch !== currentSearch) {
      const params = new URLSearchParams(searchParams.toString());
      if (debouncedSearch) params.set('search', debouncedSearch);
      else params.delete('search');
      params.set('page', '1');
      router.push(`/admin/products?${params}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Load categories once
  useEffect(() => {
    apiClient.get<CategoryOption[]>('/api/v1/admin/categories').then((res) => {
      if (res.success && res.data) setCategories(res.data);
    });
    apiClient.get<BrandOption[]>('/api/v1/admin/brands?includeHidden=true').then((res) => {
      if (res.success && res.data) setBrands(res.data);
    });
  }, []);

  const loadProducts = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const s = searchParams.get('search');
    if (s) params.set('search', s);
    const cat = searchParams.get('categoryId');
    if (cat) params.set('categoryId', cat);
    const brandParam = searchParams.get('brandId');
    if (brandParam) params.set('brandId', brandParam);
    const active = searchParams.get('isActive');
    if (active) params.set('isActive', active);
    const stock = searchParams.get('stock');
    if (stock) params.set('stock', stock);
    const sort = searchParams.get('sort');
    if (sort) params.set('sort', sort);

    apiClient
      .get<AdminProduct[]>(`/api/v1/admin/products?${params}`)
      .then((res) => {
        if (res.success && res.data) {
          setProducts(res.data);
          setTotal(res.pagination?.total || 0);
          setSelected(new Set());
        } else {
          toast.error('Не вдалося завантажити товари');
        }
      })
      .catch(() => toast.error('Помилка мережі'))
      .finally(() => setIsLoading(false));
  }, [page, limit, searchParams]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    router.push(`/admin/products?${params}`);
  };

  const handlePageSizeChange = (size: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('limit', String(size));
    params.set('page', '1');
    router.push(`/admin/products?${params}`);
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map((p) => p.id)));
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selected.size === 0) return;

    // Require confirmation for destructive actions
    if (
      ['activate', 'deactivate', 'delete', 'change_category', 'change_brand'].includes(
        bulkAction,
      ) &&
      !confirmBulk
    ) {
      setConfirmBulk(true);
      return;
    }

    setConfirmBulk(false);
    setIsProcessing(true);

    try {
      const ids = Array.from(selected);

      if (bulkAction === 'change_brand') {
        if (bulkBrandId === '') {
          toast.error('Оберіть виробника (або «Без виробника»)');
          setIsProcessing(false);
          return;
        }
        const brandIdPayload = bulkBrandId === '0' ? null : Number(bulkBrandId);
        const res = await apiClient.post('/api/v1/admin/products/bulk', {
          action: 'change_brand',
          productIds: ids,
          brandId: brandIdPayload,
        });
        if (res.success) {
          toast.success(`Виробника змінено для ${ids.length} товарів`);
          setBulkBrandId('');
          loadProducts();
        } else {
          toast.error(res.error || 'Помилка');
        }
      } else if (bulkAction === 'change_category') {
        if (!bulkCategoryId) {
          toast.error('Оберіть категорію');
          setIsProcessing(false);
          return;
        }
        const res = await apiClient.post('/api/v1/admin/products/bulk', {
          action: 'change_category',
          productIds: ids,
          categoryId: Number(bulkCategoryId),
        });
        if (res.success) {
          toast.success(`Категорію змінено для ${ids.length} товарів`);
          setBulkCategoryId('');
          loadProducts();
        } else {
          toast.error(res.error || 'Помилка');
        }
      } else if (bulkAction === 'export') {
        const res = await apiClient.post<{ url: string }>('/api/v1/admin/products/bulk', {
          action: 'export',
          productIds: ids,
        });
        if (res.success && res.data?.url) {
          window.open(res.data.url, '_blank');
          toast.success(`Експортовано ${ids.length} товарів`);
        } else {
          toast.error(res.error || 'Помилка експорту');
        }
      } else if (bulkAction === 'delete') {
        const res = await apiClient.post('/api/v1/admin/products/bulk', {
          action: 'delete',
          productIds: ids,
        });
        if (res.success) {
          toast.success(`Видалено ${ids.length} товарів`);
          loadProducts();
        } else {
          toast.error(res.error || 'Помилка');
        }
      } else {
        const res = await apiClient.post('/api/v1/admin/products/bulk', {
          action: bulkAction,
          productIds: ids,
        });
        if (res.success) {
          toast.success(`Оновлено ${ids.length} товарів`);
          loadProducts();
        } else {
          toast.error(res.error || 'Помилка');
        }
      }
    } catch {
      toast.error('Помилка виконання');
    } finally {
      setIsProcessing(false);
      setBulkAction('');
      setSelected(new Set());
    }
  };

  const handleExportAll = async () => {
    setIsProcessing(true);
    try {
      const params = new URLSearchParams();
      const s = searchParams.get('search');
      if (s) params.set('search', s);
      const cat = searchParams.get('categoryId');
      if (cat) params.set('categoryId', cat);
      const active = searchParams.get('isActive');
      if (active) params.set('isActive', active);
      const stock = searchParams.get('stock');
      if (stock) params.set('stock', stock);

      const res = await apiClient.post<{ url: string }>('/api/v1/admin/products/bulk', {
        action: 'export_filtered',
        filters: Object.fromEntries(params),
      });
      if (res.success && res.data?.url) {
        window.open(res.data.url, '_blank');
        toast.success('Експорт готовий');
      }
    } catch {
      toast.error('Помилка експорту');
    } finally {
      setIsProcessing(false);
    }
  };

  const commitSortOrder = async (product: AdminProduct, raw: string) => {
    const next = Number(raw);
    if (!Number.isFinite(next) || next === product.sortOrder) {
      setPendingSortOrder((prev) => {
        const copy = { ...prev };
        delete copy[product.id];
        return copy;
      });
      return;
    }
    const res = await apiClient.put(`/api/v1/admin/products/${product.id}`, { sortOrder: next });
    if (res.success) {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, sortOrder: next } : p)));
      toast.success('Порядок оновлено');
    } else {
      toast.error(res.error || 'Не вдалося оновити порядок');
    }
    setPendingSortOrder((prev) => {
      const copy = { ...prev };
      delete copy[product.id];
      return copy;
    });
  };

  const handleRowDelete = async () => {
    if (!rowDelete) return;
    const product = rowDelete;
    setRowDelete(null);
    setIsDeletingRow(true);
    try {
      const res = await apiClient.delete<{ hard?: boolean; message?: string }>(
        `/api/v1/admin/products/${product.id}`,
      );
      if (res.success) {
        toast.success(res.data?.message || 'Товар видалено');
        loadProducts();
      } else {
        toast.error(res.error || 'Не вдалося видалити товар');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsDeletingRow(false);
    }
  };

  const activeFilters = ['categoryId', 'brandId', 'isActive', 'stock', 'sort'].filter(
    (k) => searchParams.get(k) && (k !== 'sort' || searchParams.get(k) !== 'id_desc'),
  ).length;

  const categoryOptions = [
    { value: '', label: 'Всі категорії' },
    ...categories.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  const bulkActionLabel = BULK_ACTIONS.find((a) => a.value === bulkAction)?.label || bulkAction;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold">
          Товари{' '}
          <span className="text-base font-normal text-[var(--color-text-secondary)]">
            ({total})
          </span>
        </h2>
        <div className="flex gap-2">
          <Input
            placeholder="Пошук за назвою або кодом..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Link href="/admin/products/new">
            <Button size="sm">+ Створити товар</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            Фільтри{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportAll} isLoading={isProcessing}>
            Експорт
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/api/v1/admin/export?type=products_full', '_blank')}
          >
            Експорт повний
          </Button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="mb-4 grid gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium">Категорія</label>
            <Select
              options={categoryOptions}
              value={searchParams.get('categoryId') || ''}
              onChange={(e) => updateFilter('categoryId', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Виробник</label>
            <Select
              options={[
                { value: '', label: 'Усі виробники' },
                { value: 'null', label: '— Без виробника —' },
                ...brands.map((b) => ({ value: String(b.id), label: b.name })),
              ]}
              value={searchParams.get('brandId') || ''}
              onChange={(e) => updateFilter('brandId', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Статус</label>
            <Select
              options={STATUS_OPTIONS}
              value={searchParams.get('isActive') || ''}
              onChange={(e) => updateFilter('isActive', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Залишок</label>
            <Select
              options={STOCK_OPTIONS}
              value={searchParams.get('stock') || ''}
              onChange={(e) => updateFilter('stock', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Сортування</label>
            <Select
              options={SORT_OPTIONS}
              value={searchParams.get('sort') || 'id_desc'}
              onChange={(e) => updateFilter('sort', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2">
          <span className="text-sm text-[var(--color-text-secondary)]">
            Обрано: <strong>{selected.size}</strong>
          </span>
          <Select
            options={BULK_ACTIONS}
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
            className="w-52"
          />
          {bulkAction === 'change_category' && (
            <select
              value={bulkCategoryId}
              onChange={(e) => setBulkCategoryId(e.target.value)}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
            >
              <option value="">Оберіть категорію...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {bulkAction === 'change_brand' && (
            <select
              value={bulkBrandId}
              onChange={(e) => setBulkBrandId(e.target.value)}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
            >
              <option value="">Оберіть виробника...</option>
              <option value="0">— Без виробника —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <Button
            size="sm"
            onClick={handleBulkAction}
            isLoading={isProcessing}
            disabled={!bulkAction || selected.size === 0}
          >
            Виконати
          </Button>
        </div>
      )}

      {isLoading ? (
        <AdminTableSkeleton rows={limit > 20 ? 20 : limit} columns={8} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="px-3 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selected.size === products.length && products.length > 0}
                      onChange={toggleAll}
                      className="accent-[var(--color-primary)]"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Товар</th>
                  <th className="px-4 py-3 text-left font-medium">Код</th>
                  <th className="px-4 py-3 text-left font-medium">Категорія</th>
                  <th className="px-4 py-3 text-left font-medium">Виробник</th>
                  <th className="px-4 py-3 text-right font-medium">Ціна</th>
                  <th className="px-4 py-3 text-center font-medium">Залишок</th>
                  <th className="px-4 py-3 text-center font-medium">Продажі</th>
                  <th className="px-4 py-3 text-center font-medium">Статус</th>
                  <th className="px-4 py-3 text-center font-medium">Порядок</th>
                  <th className="px-4 py-3 text-right font-medium">Дії</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b border-[var(--color-border)] last:border-0 transition-colors ${selected.has(p.id) ? 'bg-[var(--color-primary)]/5' : 'hover:bg-[var(--color-bg-secondary)]'}`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="accent-[var(--color-primary)]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-[var(--color-bg-secondary)]">
                          {p.imagePath ? (
                            <Image
                              src={p.imagePath}
                              alt=""
                              width={40}
                              height={40}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[8px] text-[var(--color-text-secondary)]">
                              —
                            </div>
                          )}
                        </div>
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="font-medium text-[var(--color-primary)] hover:underline"
                        >
                          {p.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{p.code}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {p.category?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {p.brand?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">{Number(p.priceRetail).toFixed(2)} ₴</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={
                          p.quantity === 0
                            ? 'font-medium text-[var(--color-danger)]'
                            : p.quantity <= 5
                              ? 'text-amber-600'
                              : ''
                        }
                      >
                        {p.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-[var(--color-text-secondary)]">
                      {p.ordersCount}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {p.isActive ? 'Активний' : 'Вимкнено'}
                      </span>
                      {p.isPromo && (
                        <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                          Акція
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        value={pendingSortOrder[p.id] ?? String(p.sortOrder ?? 0)}
                        onChange={(e) =>
                          setPendingSortOrder((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        onBlur={(e) => commitSortOrder(p, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                        }}
                        className="w-16 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-center text-xs focus:border-[var(--color-primary)] focus:outline-none"
                        aria-label={`Порядок для ${p.name}`}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setRowDelete(p)}
                        disabled={isDeletingRow}
                        aria-label={`Видалити ${p.name}`}
                        title="Видалити"
                        className="rounded-md p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-8 text-center text-[var(--color-text-secondary)]"
                    >
                      Товарів не знайдено
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <p className="text-xs text-[var(--color-text-secondary)]">Всього: {total}</p>
              <PageSizeSelector value={limit} onChange={handlePageSizeChange} />
            </div>
            {total > limit && (
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(total / limit)}
                baseUrl="/admin/products"
              />
            )}
          </div>
        </>
      )}

      {/* Confirm dialog for bulk actions */}
      <ConfirmDialog
        isOpen={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={handleBulkAction}
        variant={bulkAction === 'delete' ? 'danger' : 'warning'}
        title={bulkAction === 'delete' ? 'Видалення товарів' : 'Підтвердження масової дії'}
        message={
          bulkAction === 'delete'
            ? `Видалити ${selected.size} товарів? Ті, що мають замовлення, залишаться як видалені для збереження історії; решта буде стерта повністю.`
            : `Ви впевнені, що хочете виконати "${bulkActionLabel}" для ${selected.size} товарів?`
        }
        confirmText={bulkAction === 'delete' ? 'Так, видалити' : 'Так, виконати'}
      />

      {/* Confirm dialog for per-row delete */}
      <ConfirmDialog
        isOpen={rowDelete !== null}
        onClose={() => setRowDelete(null)}
        onConfirm={handleRowDelete}
        variant="danger"
        title="Видалення товару"
        message={`Видалити "${rowDelete?.name}"? Якщо товар має замовлення, він залишиться в системі як видалений (інакше буде стертий повністю).`}
        confirmText="Так, видалити"
      />
    </div>
  );
}
