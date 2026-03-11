'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';

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
  category: { id: number; name: string } | null;
}

interface CategoryOption {
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
];

const BULK_ACTIONS = [
  { value: '', label: 'Масова дія...' },
  { value: 'activate', label: 'Активувати' },
  { value: 'deactivate', label: 'Деактивувати' },
  { value: 'change_category', label: 'Змінити категорію' },
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState('');

  const page = Number(searchParams.get('page')) || 1;
  const limit = 20;

  // Load categories once
  useEffect(() => {
    apiClient.get<CategoryOption[]>('/api/v1/admin/categories').then((res) => {
      if (res.success && res.data) setCategories(res.data);
    });
  }, []);

  const loadProducts = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const s = searchParams.get('search');
    if (s) params.set('search', s);
    const cat = searchParams.get('categoryId');
    if (cat) params.set('categoryId', cat);
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
        }
      })
      .finally(() => setIsLoading(false));
  }, [page, searchParams]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    router.push(`/admin/products?${params}`);
  };

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set('search', search);
    else params.delete('search');
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
    setIsProcessing(true);
    setMessage(null);

    try {
      const ids = Array.from(selected);

      if (bulkAction === 'change_category') {
        if (!bulkCategoryId) {
          setMessage({ type: 'error', text: 'Оберіть категорію' });
          setIsProcessing(false);
          return;
        }
        const res = await apiClient.post('/api/v1/admin/products/bulk', {
          action: 'change_category', productIds: ids, categoryId: Number(bulkCategoryId),
        });
        if (res.success) {
          setMessage({ type: 'success', text: `Категорію змінено для ${ids.length} товарів` });
          setBulkCategoryId('');
          loadProducts();
        } else {
          setMessage({ type: 'error', text: res.error || 'Помилка' });
        }
      } else if (bulkAction === 'export') {
        const res = await apiClient.post<{ url: string }>('/api/v1/admin/products/bulk', {
          action: 'export', productIds: ids,
        });
        if (res.success && res.data?.url) {
          window.open(res.data.url, '_blank');
          setMessage({ type: 'success', text: `Експортовано ${ids.length} товарів` });
        } else {
          setMessage({ type: 'error', text: res.error || 'Помилка експорту' });
        }
      } else {
        const res = await apiClient.post('/api/v1/admin/products/bulk', {
          action: bulkAction, productIds: ids,
        });
        if (res.success) {
          setMessage({ type: 'success', text: `Оновлено ${ids.length} товарів` });
          loadProducts();
        } else {
          setMessage({ type: 'error', text: res.error || 'Помилка' });
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Помилка виконання' });
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
        action: 'export_filtered', filters: Object.fromEntries(params),
      });
      if (res.success && res.data?.url) {
        window.open(res.data.url, '_blank');
        setMessage({ type: 'success', text: 'Експорт готовий' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Помилка експорту' });
    } finally {
      setIsProcessing(false);
    }
  };

  const activeFilters = ['categoryId', 'isActive', 'stock', 'sort'].filter(
    (k) => searchParams.get(k) && (k !== 'sort' || searchParams.get(k) !== 'id_desc')
  ).length;

  const categoryOptions = [
    { value: '', label: 'Всі категорії' },
    ...categories.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Товари <span className="text-base font-normal text-[var(--color-text-secondary)]">({total})</span></h2>
        <div className="flex gap-2">
          <Input
            placeholder="Пошук за назвою або кодом..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-64"
          />
          <Button variant="outline" size="sm" onClick={handleSearch}>Знайти</Button>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            Фільтри{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportAll} isLoading={isProcessing}>Експорт</Button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="mb-4 grid gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium">Категорія</label>
            <Select options={categoryOptions} value={searchParams.get('categoryId') || ''} onChange={(e) => updateFilter('categoryId', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Статус</label>
            <Select options={STATUS_OPTIONS} value={searchParams.get('isActive') || ''} onChange={(e) => updateFilter('isActive', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Залишок</label>
            <Select options={STOCK_OPTIONS} value={searchParams.get('stock') || ''} onChange={(e) => updateFilter('stock', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Сортування</label>
            <Select options={SORT_OPTIONS} value={searchParams.get('sort') || 'id_desc'} onChange={(e) => updateFilter('sort', e.target.value)} />
          </div>
        </div>
      )}

      {message && (
        <div className={`mb-4 rounded-[var(--radius)] p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-[var(--color-danger)]'}`}>
          {message.text}
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2">
          <span className="text-sm text-[var(--color-text-secondary)]">
            Обрано: <strong>{selected.size}</strong>
          </span>
          <Select options={BULK_ACTIONS} value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="w-52" />
          {bulkAction === 'change_category' && (
            <select
              value={bulkCategoryId}
              onChange={(e) => setBulkCategoryId(e.target.value)}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
            >
              <option value="">Оберіть категорію...</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <Button size="sm" onClick={handleBulkAction} isLoading={isProcessing} disabled={!bulkAction || selected.size === 0}>
            Виконати
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="md" /></div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="px-3 py-3 text-left">
                    <input type="checkbox" checked={selected.size === products.length && products.length > 0} onChange={toggleAll} className="accent-[var(--color-primary)]" />
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Товар</th>
                  <th className="px-4 py-3 text-left font-medium">Код</th>
                  <th className="px-4 py-3 text-left font-medium">Категорія</th>
                  <th className="px-4 py-3 text-right font-medium">Ціна</th>
                  <th className="px-4 py-3 text-center font-medium">Залишок</th>
                  <th className="px-4 py-3 text-center font-medium">Продажі</th>
                  <th className="px-4 py-3 text-center font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b border-[var(--color-border)] last:border-0 ${selected.has(p.id) ? 'bg-[var(--color-primary)]/5' : 'hover:bg-[var(--color-bg-secondary)]'}`}
                  >
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="accent-[var(--color-primary)]" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-[var(--color-bg-secondary)]">
                          {p.imagePath ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={p.imagePath} alt="" className="h-full w-full object-contain" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[8px] text-[var(--color-text-secondary)]">—</div>
                          )}
                        </div>
                        <Link href={`/admin/products/${p.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                          {p.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{p.code}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{p.category?.name || '—'}</td>
                    <td className="px-4 py-3 text-right">{Number(p.priceRetail).toFixed(2)} ₴</td>
                    <td className="px-4 py-3 text-center">
                      <span className={p.quantity === 0 ? 'font-medium text-[var(--color-danger)]' : p.quantity <= 5 ? 'text-amber-600' : ''}>
                        {p.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-[var(--color-text-secondary)]">{p.ordersCount}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.isActive ? 'Активний' : 'Вимкнено'}
                      </span>
                      {p.isPromo && (
                        <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Акція</span>
                      )}
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                      Товарів не знайдено
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {total > limit && (
            <Pagination currentPage={page} totalPages={Math.ceil(total / limit)} baseUrl="/admin/products" className="mt-6" />
          )}
        </>
      )}
    </div>
  );
}
