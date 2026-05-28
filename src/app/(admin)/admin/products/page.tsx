'use client';

import { useEffect, useState, useCallback, useRef, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';
import SavedViews from '@/components/admin/SavedViews';
import PageSizeSelector from '@/components/admin/PageSizeSelector';
import ProductQuickEditDrawer from '@/components/admin/ProductQuickEditDrawer';
import KeyboardShortcutsHelp from '@/components/admin/KeyboardShortcutsHelp';
import InventoryStatsWidget from '@/components/admin/InventoryStatsWidget';
import { useDebounce } from '@/hooks/useDebounce';
import { useOrderListKeyboard } from '@/hooks/useOrderListKeyboard';
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
  barcode: string | null;
  ordersCount: number;
  sortOrder: number;
  version?: number;
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

// Next.js requires components that call useSearchParams() to live inside a
// Suspense boundary. Without this wrapper the build emits a warning and the
// page de-opts to fully dynamic rendering even when it doesn't need to.
export default function AdminProductsPage() {
  return (
    <Suspense fallback={<AdminTableSkeleton rows={8} columns={6} />}>
      <AdminProductsPageInner />
    </Suspense>
  );
}

function AdminProductsPageInner() {
  const t = useTranslations('admin.productsListPage');
  const STATUS_OPTIONS = useMemo(
    () => [
      { value: '', label: t('statusAll') },
      { value: 'true', label: t('statusActive') },
      { value: 'false', label: t('statusDisabled') },
    ],
    [t],
  );
  const STOCK_OPTIONS = useMemo(
    () => [
      { value: '', label: t('stockAll') },
      { value: 'out', label: t('stockOut') },
      { value: 'low', label: t('stockLow') },
      { value: 'in', label: t('stockIn') },
    ],
    [t],
  );
  const SORT_OPTIONS = useMemo(
    () => [
      { value: 'id_desc', label: t('sortNewest') },
      { value: 'id_asc', label: t('sortOldest') },
      { value: 'name_asc', label: t('sortNameAsc') },
      { value: 'name_desc', label: t('sortNameDesc') },
      { value: 'price_asc', label: t('sortPriceAsc') },
      { value: 'price_desc', label: t('sortPriceDesc') },
      { value: 'quantity_asc', label: t('sortQtyAsc') },
      { value: 'quantity_desc', label: t('sortQtyDesc') },
      { value: 'sales_desc', label: t('sortSales') },
      { value: 'sort_order_asc', label: t('sortOrderAsc') },
      { value: 'sort_order_desc', label: t('sortOrderDesc') },
      { value: 'category_asc', label: t('sortCatAsc') },
      { value: 'category_desc', label: t('sortCatDesc') },
    ],
    [t],
  );
  const BULK_ACTIONS = useMemo(
    () => [
      { value: '', label: t('bulkPlaceholder') },
      { value: 'activate', label: t('bulkActivate') },
      { value: 'deactivate', label: t('bulkDeactivate') },
      { value: 'delete', label: t('bulkDelete') },
      { value: 'change_category', label: t('bulkChangeCategory') },
      { value: 'change_brand', label: t('bulkChangeBrand') },
      { value: 'change_price', label: t('bulkChangePrice') },
      { value: 'export', label: t('bulkExport') },
      { value: 'labels', label: t('bulkLabels') },
    ],
    [t],
  );
  const PRICE_TARGET_OPTIONS = useMemo(
    () => [
      { value: 'retail', label: t('ptRetail') },
      { value: 'wholesale', label: t('ptWholesale') },
      { value: 'wholesale2', label: t('ptWholesale2') },
      { value: 'wholesale3', label: t('ptWholesale3') },
      { value: 'all', label: t('ptAll') },
    ],
    [t],
  );
  const PRICE_MODE_OPTIONS = useMemo(
    () => [
      { value: 'percent', label: t('pmPercent') },
      { value: 'add', label: t('pmAdd') },
      { value: 'fixed', label: t('pmFixed') },
      { value: 'round', label: t('pmRound') },
    ],
    [t],
  );
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
  const [bulkPriceTarget, setBulkPriceTarget] = useState('retail');
  const [bulkPriceMode, setBulkPriceMode] = useState('percent');
  const [bulkPriceValue, setBulkPriceValue] = useState('');
  const [bulkPriceRound, setBulkPriceRound] = useState('10');
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [rowDelete, setRowDelete] = useState<AdminProduct | null>(null);
  const [quickEditId, setQuickEditId] = useState<number | null>(null);
  const [isDeletingRow, setIsDeletingRow] = useState(false);
  const [pendingSortOrder, setPendingSortOrder] = useState<Record<number, string>>({});
  const [focusIndex, setFocusIndex] = useState(-1);
  // Synchronous in-flight guard. A fast double-click on "Apply" would
  // otherwise fire two POSTs (and for change_price, double-apply the
  // percent — turning +10% into +21%).
  const bulkInFlight = useRef(false);
  const { helpOpen, setHelpOpen } = useOrderListKeyboard({
    orderIds: products.map((p) => p.id),
    focusIndex,
    setFocusIndex,
    onQuickEdit: (id) => setQuickEditId(id),
    detailPathPrefix: '/admin/products',
  });
  // Reset focus on actual list change — `products.length` missed filter
  // swaps that kept the count but moved the rows under the focus index.
  const productsFocusSig = products.map((p) => p.id).join(',');
  useEffect(() => {
    setFocusIndex(-1);
  }, [productsFocusSig]);
  const [pendingPrice, setPendingPrice] = useState<Record<number, string>>({});
  const [pendingQty, setPendingQty] = useState<Record<number, string>>({});

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

  const buildProductsQuery = useCallback(() => {
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
    const missingBarcode = searchParams.get('missingBarcode');
    if (missingBarcode) params.set('missingBarcode', missingBarcode);
    const sort = searchParams.get('sort');
    if (sort) params.set('sort', sort);
    return params.toString();
  }, [page, limit, searchParams]);

  const [reloadToken, setReloadToken] = useState(0);
  const loadProducts = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const qs = buildProductsQuery();
    apiClient
      .get<AdminProduct[]>(`/api/v1/admin/products?${qs}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setProducts(res.data);
          setTotal(res.pagination?.total || 0);
          setSelected(new Set());
        } else {
          toast.error(res.error || t('loadError'));
        }
      })
      .catch(() => {
        if (!cancelled) toast.error(t('networkError'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [buildProductsQuery, reloadToken, t]);

  const [isReindexing, setIsReindexing] = useState(false);
  const [confirmReindex, setConfirmReindex] = useState(false);
  const handleReindex = async () => {
    setConfirmReindex(false);
    setIsReindexing(true);
    try {
      const res = await apiClient.post<{ indexed: number }>('/api/v1/admin/typesense/reindex');
      if (res.success && res.data) {
        toast.success(t('reindexed', { count: res.data.indexed }));
      } else {
        toast.error(res.error || t('reindexError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsReindexing(false);
    }
  };

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    // Clear pending inline drafts — otherwise the user sees a price/qty/sort
    // input pre-filled with a value from a row that is no longer visible
    // after the filter change.
    setPendingPrice({});
    setPendingQty({});
    setPendingSortOrder({});
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
      [
        'activate',
        'deactivate',
        'delete',
        'change_category',
        'change_brand',
        'change_price',
      ].includes(bulkAction) &&
      !confirmBulk
    ) {
      setConfirmBulk(true);
      return;
    }

    if (bulkInFlight.current) return;
    bulkInFlight.current = true;
    setConfirmBulk(false);
    setIsProcessing(true);

    try {
      const ids = Array.from(selected);

      if (bulkAction === 'change_brand') {
        if (bulkBrandId === '') {
          toast.error(t('selectBrand'));
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
          toast.success(t('brandChanged', { count: ids.length }));
          setBulkBrandId('');
          loadProducts();
        } else {
          toast.error(res.error || t('error'));
        }
      } else if (bulkAction === 'change_category') {
        if (!bulkCategoryId) {
          toast.error(t('selectCategory'));
          setIsProcessing(false);
          return;
        }
        const res = await apiClient.post('/api/v1/admin/products/bulk', {
          action: 'change_category',
          productIds: ids,
          categoryId: Number(bulkCategoryId),
        });
        if (res.success) {
          toast.success(t('categoryChanged', { count: ids.length }));
          setBulkCategoryId('');
          loadProducts();
        } else {
          toast.error(res.error || t('error'));
        }
      } else if (bulkAction === 'change_price') {
        const valNum = bulkPriceMode === 'round' ? undefined : Number(bulkPriceValue);
        if (bulkPriceMode !== 'round' && (bulkPriceValue === '' || Number.isNaN(valNum))) {
          toast.error(t('enterNumber'));
          setIsProcessing(false);
          return;
        }
        const res = await apiClient.post<{ updated: number; skipped: number }>(
          '/api/v1/admin/products/bulk',
          {
            action: 'change_price',
            productIds: ids,
            priceTarget: bulkPriceTarget,
            priceMode: bulkPriceMode,
            priceValue: valNum,
            priceRound: bulkPriceMode === 'round' ? Number(bulkPriceRound) : undefined,
          },
        );
        if (res.success && res.data) {
          toast.success(
            t('pricesUpdated', { updated: res.data.updated }) +
              (res.data.skipped > 0
                ? t('pricesUpdatedSkipped', { skipped: res.data.skipped })
                : ''),
          );
          setBulkPriceValue('');
          loadProducts();
        } else {
          toast.error(res.error || t('priceChangeError'));
        }
      } else if (bulkAction === 'export') {
        const res = await apiClient.post<{ url: string }>('/api/v1/admin/products/bulk', {
          action: 'export',
          productIds: ids,
        });
        if (res.success && res.data?.url) {
          window.open(res.data.url, '_blank');
          toast.success(t('exported', { count: ids.length }));
        } else {
          toast.error(res.error || t('exportError'));
        }
      } else if (bulkAction === 'labels') {
        const raw = window.prompt(t('labelsCopiesPrompt'), '1');
        if (raw === null) return;
        const copies = Math.max(1, Math.min(100, parseInt(raw, 10) || 1));
        try {
          const resp = await fetch('/api/v1/admin/products/labels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productIds: ids, copiesEach: copies }),
          });
          if (!resp.ok) {
            const errBody = await resp.json().catch(() => ({ error: t('error') }));
            toast.error(errBody.error || t('errorWithStatus', { status: resp.status }));
            return;
          }
          const skipped = Number(resp.headers.get('X-Skipped') || '0');
          const printed = Number(resp.headers.get('X-Printed') || '0');
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          toast.success(
            t('labelsGenerated', { printed }) +
              (skipped > 0 ? t('labelsSkipped', { skipped }) : ''),
          );
        } catch (err) {
          toast.error(t('errorWith', { err: String(err) }));
        }
      } else if (bulkAction === 'delete') {
        const res = await apiClient.post('/api/v1/admin/products/bulk', {
          action: 'delete',
          productIds: ids,
        });
        if (res.success) {
          toast.success(t('deletedN', { count: ids.length }));
          loadProducts();
        } else {
          toast.error(res.error || t('error'));
        }
      } else {
        const res = await apiClient.post('/api/v1/admin/products/bulk', {
          action: bulkAction,
          productIds: ids,
        });
        if (res.success) {
          toast.success(t('updatedN', { count: ids.length }));
          loadProducts();
        } else {
          toast.error(res.error || t('error'));
        }
      }
    } catch {
      toast.error(t('execError'));
    } finally {
      bulkInFlight.current = false;
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
        toast.success(t('exportReady'));
      }
    } catch {
      toast.error(t('exportError'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Shared helper: send a PUT with the row's optimistic-lock version and
  // on 409 re-fetch the row + revert the optimistic UI change. Detects the
  // case where another admin edited the same product in a parallel tab.
  const commitInlineField = async <K extends keyof AdminProduct>(
    product: AdminProduct,
    field: K,
    next: AdminProduct[K],
    successMessage: string,
  ): Promise<boolean> => {
    const res = await apiClient.put<AdminProduct>(`/api/v1/admin/products/${product.id}`, {
      [field]: next,
      version: product.version,
    });
    if (res.success && res.data) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? { ...p, [field]: next, version: res.data!.version ?? (p.version ?? 0) + 1 }
            : p,
        ),
      );
      toast.success(successMessage);
      return true;
    }
    if (res.statusCode === 409) {
      const refreshed = await apiClient.get<AdminProduct>(`/api/v1/admin/products/${product.id}`);
      if (refreshed.success && refreshed.data) {
        setProducts((prev) => prev.map((p) => (p.id === product.id ? refreshed.data! : p)));
      }
      toast.error(t('conflictReload'));
      return false;
    }
    toast.error(res.error || t('error'));
    return false;
  };

  const commitInlinePrice = async (product: AdminProduct, raw: string) => {
    const next = Number(raw);
    if (!Number.isFinite(next) || next <= 0 || next === Number(product.priceRetail)) {
      setPendingPrice((prev) => {
        const copy = { ...prev };
        delete copy[product.id];
        return copy;
      });
      return;
    }
    await commitInlineField(product, 'priceRetail', next, t('priceUpdated'));
    setPendingPrice((prev) => {
      const copy = { ...prev };
      delete copy[product.id];
      return copy;
    });
  };

  const commitInlineQty = async (product: AdminProduct, raw: string) => {
    const next = Number(raw);
    if (!Number.isFinite(next) || next < 0 || next === product.quantity) {
      setPendingQty((prev) => {
        const copy = { ...prev };
        delete copy[product.id];
        return copy;
      });
      return;
    }
    await commitInlineField(product, 'quantity', next, t('qtyUpdated'));
    setPendingQty((prev) => {
      const copy = { ...prev };
      delete copy[product.id];
      return copy;
    });
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
    await commitInlineField(product, 'sortOrder', next, t('sortUpdated'));
    setPendingSortOrder((prev) => {
      const copy = { ...prev };
      delete copy[product.id];
      return copy;
    });
  };

  const handleDuplicate = async (product: AdminProduct) => {
    try {
      const res = await apiClient.post<{ id: number; code: string; name: string }>(
        `/api/v1/admin/products/${product.id}/duplicate`,
      );
      if (res.success && res.data) {
        toast.success(t('copyCreated', { code: res.data.code }));
        router.push(`/admin/products/${res.data.id}`);
      } else {
        toast.error(res.error || t('duplicateError'));
      }
    } catch {
      toast.error(t('networkError'));
    }
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
        toast.success(res.data?.message || t('productDeleted'));
        loadProducts();
      } else {
        toast.error(res.error || t('deleteError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsDeletingRow(false);
    }
  };

  const activeFilters = [
    'categoryId',
    'brandId',
    'isActive',
    'stock',
    'sort',
    'missingBarcode',
  ].filter(
    (k) => searchParams.get(k) && (k !== 'sort' || searchParams.get(k) !== 'id_desc'),
  ).length;

  const categoryOptions = [
    { value: '', label: t('allCategories') },
    ...categories.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  const bulkActionLabel = BULK_ACTIONS.find((a) => a.value === bulkAction)?.label || bulkAction;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold">
          {t('title')}{' '}
          <span className="text-base font-normal text-[var(--color-text-secondary)]">
            ({total})
          </span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Link href="/admin/products/new">
            <Button size="sm">{t('createProduct')}</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            {t('filters')}
            {activeFilters > 0 ? ` (${activeFilters})` : ''}
          </Button>
          <ProductsMoreMenu
            onExport={handleExportAll}
            onExportFull={() => window.open('/api/v1/admin/export?type=products_full', '_blank')}
            onReindex={() => setConfirmReindex(true)}
            isProcessing={isProcessing}
            isReindexing={isReindexing}
          />
        </div>
      </div>

      <div className="mb-3">
        <SavedViews storageKey="products" basePath="/admin/products" />
      </div>

      <InventoryStatsWidget />

      {/* Filters panel */}
      {showFilters && (
        <div className="mb-4 grid gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium">{t('categoryLabel')}</label>
            <Select
              options={categoryOptions}
              value={searchParams.get('categoryId') || ''}
              onChange={(e) => updateFilter('categoryId', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t('brandLabel')}</label>
            <Select
              options={[
                { value: '', label: t('allBrands') },
                { value: 'null', label: t('noBrandOption') },
                ...brands.map((b) => ({ value: String(b.id), label: b.name })),
              ]}
              value={searchParams.get('brandId') || ''}
              onChange={(e) => updateFilter('brandId', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t('statusLabel')}</label>
            <Select
              options={STATUS_OPTIONS}
              value={searchParams.get('isActive') || ''}
              onChange={(e) => updateFilter('isActive', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t('stockLabel')}</label>
            <Select
              options={STOCK_OPTIONS}
              value={searchParams.get('stock') || ''}
              onChange={(e) => updateFilter('stock', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t('sortLabel')}</label>
            <Select
              options={SORT_OPTIONS}
              value={searchParams.get('sort') || 'id_desc'}
              onChange={(e) => updateFilter('sort', e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={searchParams.get('missingBarcode') === '1'}
                onChange={(e) => updateFilter('missingBarcode', e.target.checked ? '1' : '')}
                className="accent-[var(--color-primary)]"
              />
              {t('onlyMissingBarcode')}
            </label>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2">
          <span className="text-sm text-[var(--color-text-secondary)]">
            {t('selectedPre')} <strong>{selected.size}</strong> {t('selectedPost')}
            {total > products.length && (
              <span className="ml-2 text-xs text-amber-700" title={t('bulkScopeTitle')}>
                {t('bulkScopeWarn', { total })}
              </span>
            )}
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
              <option value="">{t('selectCategoryPlaceholder')}</option>
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
              <option value="">{t('selectBrandPlaceholder')}</option>
              <option value="0">{t('noBrandOption')}</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          {bulkAction === 'change_price' && (
            <>
              <select
                value={bulkPriceTarget}
                onChange={(e) => setBulkPriceTarget(e.target.value)}
                className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
                aria-label={t('priceTypeAria')}
              >
                {PRICE_TARGET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                value={bulkPriceMode}
                onChange={(e) => setBulkPriceMode(e.target.value)}
                className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
                aria-label={t('priceModeAria')}
              >
                {PRICE_MODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {bulkPriceMode === 'round' ? (
                <select
                  value={bulkPriceRound}
                  onChange={(e) => setBulkPriceRound(e.target.value)}
                  className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
                  aria-label={t('roundStepAria')}
                >
                  <option value="1">{t('roundTo1')}</option>
                  <option value="5">{t('roundTo5')}</option>
                  <option value="10">{t('roundTo10')}</option>
                  <option value="50">{t('roundTo50')}</option>
                  <option value="100">{t('roundTo100')}</option>
                </select>
              ) : (
                <input
                  type="number"
                  step="0.01"
                  value={bulkPriceValue}
                  onChange={(e) => setBulkPriceValue(e.target.value)}
                  placeholder={
                    bulkPriceMode === 'percent'
                      ? t('pricePercentPh')
                      : bulkPriceMode === 'add'
                        ? t('priceAddPh')
                        : t('priceFixedPh')
                  }
                  className="w-28 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
                  aria-label={t('valueAria')}
                />
              )}
            </>
          )}
          <Button
            size="sm"
            onClick={handleBulkAction}
            isLoading={isProcessing}
            disabled={!bulkAction || selected.size === 0}
          >
            {t('execute')}
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
                  <th className="px-4 py-3 text-left font-medium">{t('thProduct')}</th>
                  <th className="hidden px-4 py-3 text-left font-medium md:table-cell">
                    {t('thCode')}
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium lg:table-cell">
                    {t('thCategory')}
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium lg:table-cell">
                    {t('thBrand')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">{t('thPrice')}</th>
                  <th className="px-4 py-3 text-center font-medium">{t('thStock')}</th>
                  <th className="hidden px-4 py-3 text-center font-medium xl:table-cell">
                    {t('thSales')}
                  </th>
                  <th className="px-4 py-3 text-center font-medium">{t('thStatus')}</th>
                  <th className="hidden px-4 py-3 text-center font-medium xl:table-cell">
                    {t('thOrder')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">{t('thActions')}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, idx) => (
                  <tr
                    key={p.id}
                    className={`border-b border-[var(--color-border)] last:border-0 transition-colors ${selected.has(p.id) ? 'bg-[var(--color-primary)]/5' : 'hover:bg-[var(--color-bg-secondary)]'} ${idx === focusIndex ? 'outline outline-2 outline-[var(--color-primary)]' : ''}`}
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
                              alt={p.name}
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
                    <td className="hidden px-4 py-3 text-[var(--color-text-secondary)] md:table-cell">
                      <div>{p.code}</div>
                      {p.barcode && (
                        <div
                          className="mt-0.5 font-mono text-[10px] leading-tight text-[var(--color-text-tertiary)]"
                          title={t('barcodeTitle')}
                        >
                          {p.barcode}
                        </div>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--color-text-secondary)] lg:table-cell">
                      {p.category?.name || '—'}
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--color-text-secondary)] lg:table-cell">
                      {p.brand?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={pendingPrice[p.id] ?? String(p.priceRetail)}
                        onChange={(e) =>
                          setPendingPrice((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        onBlur={(e) => commitInlinePrice(p, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                        }}
                        className="no-spinner w-24 rounded-md border border-transparent bg-transparent px-2 py-1 text-right text-sm hover:border-[var(--color-border)] focus:border-[var(--color-primary)] focus:bg-[var(--color-bg)] focus:outline-none"
                        aria-label={t('priceAria', { name: p.name })}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        value={pendingQty[p.id] ?? String(p.quantity)}
                        onChange={(e) =>
                          setPendingQty((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        onBlur={(e) => commitInlineQty(p, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                        }}
                        className={`no-spinner w-16 rounded-md border border-transparent bg-transparent px-2 py-1 text-center text-sm hover:border-[var(--color-border)] focus:border-[var(--color-primary)] focus:bg-[var(--color-bg)] focus:outline-none ${
                          p.quantity === 0
                            ? 'font-medium text-[var(--color-danger)]'
                            : p.quantity <= 5
                              ? 'text-amber-600'
                              : ''
                        }`}
                        aria-label={t('qtyAria', { name: p.name })}
                      />
                    </td>
                    <td className="hidden px-4 py-3 text-center text-[var(--color-text-secondary)] xl:table-cell">
                      {p.ordersCount}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {p.isActive ? t('statusActiveBadge') : t('statusDisabledBadge')}
                      </span>
                      {p.isPromo && (
                        <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                          {t('promoBadge')}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-center xl:table-cell">
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
                        className="no-spinner w-16 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-center text-xs focus:border-[var(--color-primary)] focus:outline-none"
                        aria-label={t('sortAria', { name: p.name })}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/product/${p.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={t('viewOnSiteAria', { name: p.name })}
                        title={t('viewOnSiteTitle')}
                        className="mr-1 inline-block rounded-md p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
                      >
                        ↗
                      </a>
                      <button
                        type="button"
                        onClick={() => setQuickEditId(p.id)}
                        aria-label={t('quickEditAria', { name: p.name })}
                        title={t('quickEditTitle')}
                        className="mr-1 rounded-md p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(p)}
                        aria-label={t('duplicateAria', { name: p.name })}
                        title={t('duplicateTitle')}
                        className="mr-1 rounded-md p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
                      >
                        ⎘
                      </button>
                      <button
                        type="button"
                        onClick={() => setRowDelete(p)}
                        disabled={isDeletingRow}
                        aria-label={t('deleteAria', { name: p.name })}
                        title={t('deleteTitle')}
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
                    <td colSpan={11} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3 text-[var(--color-text-secondary)]">
                        <span className="text-3xl" aria-hidden="true">
                          🛒
                        </span>
                        <p className="text-sm font-medium">{t('emptyTitle')}</p>
                        <Link
                          href="/admin/products/new"
                          className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-dark)]"
                        >
                          {t('createFirst')}
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <p className="text-xs text-[var(--color-text-secondary)]">{t('total', { total })}</p>
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
        title={
          bulkAction === 'delete'
            ? t('confirmDeleteTitle')
            : bulkAction === 'change_price'
              ? t('confirmPriceTitle')
              : t('confirmBulkTitle')
        }
        message={
          bulkAction === 'delete'
            ? t('confirmDeleteMsg', { count: selected.size })
            : bulkAction === 'change_price'
              ? (() => {
                  const targetLabel =
                    PRICE_TARGET_OPTIONS.find((o) => o.value === bulkPriceTarget)?.label ||
                    bulkPriceTarget;
                  const modeLabel =
                    PRICE_MODE_OPTIONS.find((o) => o.value === bulkPriceMode)?.label ||
                    bulkPriceMode;
                  const valueLabel =
                    bulkPriceMode === 'round'
                      ? t('valGrn', { v: bulkPriceRound })
                      : bulkPriceMode === 'percent'
                        ? t('valPct', { v: bulkPriceValue })
                        : t('valGrn', { v: bulkPriceValue });

                  // Preview: compute the same transform the server will apply
                  // for the first 3 currently-visible selected products. Lets
                  // the operator sanity-check the math before committing.
                  const valueNum = Number(bulkPriceValue);
                  const roundStep = Number(bulkPriceRound);
                  const samples = products
                    .filter((p) => selected.has(p.id))
                    .slice(0, 3)
                    .map((p) => {
                      const current = Number(p.priceRetail);
                      let next = current;
                      if (bulkPriceMode === 'percent') next = current * (1 + valueNum / 100);
                      else if (bulkPriceMode === 'add') next = current + valueNum;
                      else if (bulkPriceMode === 'fixed') next = valueNum;
                      else if (bulkPriceMode === 'round' && roundStep > 0)
                        next = Math.round(current / roundStep) * roundStep;
                      next = Math.max(0, Math.round(next * 100) / 100);
                      return t('sampleLine', {
                        code: p.code,
                        name: p.name,
                        from: current.toFixed(2),
                        to: next.toFixed(2),
                      });
                    });
                  const preview =
                    samples.length > 0
                      ? t('pricePreviewExample', {
                          samples:
                            samples.join('\n') +
                            (selected.size > 3
                              ? t('priceMoreSamples', { count: selected.size - 3 })
                              : ''),
                        })
                      : '';

                  return t('confirmPriceMsg', {
                    mode: modeLabel,
                    value: valueLabel,
                    target: targetLabel,
                    count: selected.size,
                    preview,
                  });
                })()
              : t('confirmBulkMsg', { action: bulkActionLabel, count: selected.size })
        }
        confirmText={bulkAction === 'delete' ? t('confirmDeleteBtn') : t('confirmExecuteBtn')}
      />

      {/* Confirm dialog for per-row delete */}
      <ConfirmDialog
        isOpen={rowDelete !== null}
        onClose={() => setRowDelete(null)}
        onConfirm={handleRowDelete}
        variant="danger"
        title={t('rowDeleteTitle')}
        message={t('rowDeleteMsg', { name: rowDelete?.name ?? '' })}
        confirmText={t('confirmDeleteBtn')}
      />

      {/* Confirm dialog for reindex */}
      <ConfirmDialog
        isOpen={confirmReindex}
        onClose={() => setConfirmReindex(false)}
        onConfirm={handleReindex}
        variant="warning"
        title={t('reindexTitle')}
        message={t('reindexMsg')}
        confirmText={t('reindexConfirm')}
        isLoading={isReindexing}
      />

      <ProductQuickEditDrawer
        productId={quickEditId}
        onClose={() => setQuickEditId(null)}
        onSaved={() => loadProducts()}
      />

      <KeyboardShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <button
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-4 right-4 z-10 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text-secondary)] shadow-lg hover:text-[var(--color-primary)]"
        title={t('shortcutsTitle')}
        aria-label={t('shortcutsAria')}
      >
        <kbd className="font-mono">?</kbd>
      </button>
    </div>
  );
}

function ProductsMoreMenu({
  onExport,
  onExportFull,
  onReindex,
  isProcessing,
  isReindexing,
}: {
  onExport: () => void;
  onExportFull: () => void;
  onReindex: () => void;
  isProcessing: boolean;
  isReindexing: boolean;
}) {
  const t = useTranslations('admin.productsListPage');
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('moreActions')}
      >
        {t('more')}
      </Button>
      {open && (
        <div
          className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-md"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => {
              onExport();
              setOpen(false);
            }}
            className="block w-full px-3 py-2 text-left text-xs hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
          >
            {t('exportXlsxFiltered')}
          </button>
          <button
            type="button"
            onClick={() => {
              onExportFull();
              setOpen(false);
            }}
            className="block w-full px-3 py-2 text-left text-xs hover:bg-[var(--color-bg-secondary)]"
          >
            {t('exportFull')}
          </button>
          <div className="border-t border-[var(--color-border)]" />
          <button
            type="button"
            disabled={isReindexing}
            onClick={() => {
              onReindex();
              setOpen(false);
            }}
            className="block w-full px-3 py-2 text-left text-xs hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
            title={t('reindexMenuTitle')}
          >
            {t('reindexSearch')}
          </button>
        </div>
      )}
    </div>
  );
}
