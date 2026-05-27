'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';
import PageSizeSelector from '@/components/admin/PageSizeSelector';
import { useDebounce } from '@/hooks/useDebounce';
import { SEARCH_DEBOUNCE_MS, DEFAULT_PAGE_SIZE } from '@/config/admin-constants';
import Image from 'next/image';
import {
  MARKETPLACES,
  MARKETPLACE_BY_KEY,
  type MarketplaceConfig,
  type ProductForMarketplace,
} from '../_shared';

export function ProductsTab() {
  const [products, setProducts] = useState<ProductForMarketplace[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [targetMarketplace, setTargetMarketplace] = useState('olx');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState({ current: 0, total: 0 });
  const [publishResults, setPublishResults] = useState<
    { id: number; name: string; status: string; error?: string }[]
  >([]);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showOnlyUnpublished, setShowOnlyUnpublished] = useState(false);
  const [marketplaceStatuses, setMarketplaceStatuses] = useState<Record<string, boolean>>({});
  const [publishedIds, setPublishedIds] = useState<Record<string, Set<number>>>({});

  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
  // Derive isLoading from a request key (changes whenever fetch inputs change).
  // `showOnlyUnpublished` + `targetMarketplace` are part of the key because
  // they translate into a server-side notPublishedOn filter — flipping them
  // changes which page of products comes back.
  const productsRequestKey = `${page}|${limit}|${debouncedSearch}|${showOnlyUnpublished ? targetMarketplace : ''}`;
  const [productsCompletedKey, setProductsCompletedKey] = useState<string | null>(null);
  const isLoading = productsCompletedKey !== productsRequestKey;

  // Load marketplace connection statuses
  useEffect(() => {
    apiClient
      .get<Record<string, MarketplaceConfig | null>>('/api/v1/admin/channel-settings')
      .then((res) => {
        if (res.success && res.data) {
          const statuses: Record<string, boolean> = {};
          for (const m of MARKETPLACES) {
            const config = res.data[m.key] as MarketplaceConfig | null;
            statuses[m.key] = config?.enabled === true;
          }
          setMarketplaceStatuses(statuses);
        }
      });
  }, []);

  // Load which products are already published on each marketplace.
  // Uses a dedicated aggregated endpoint so the full set fits in one request
  // without a `limit=1000` cap that silently broke once publications grew
  // past 1k rows.
  useEffect(() => {
    apiClient
      .get<Record<string, number[]>>('/api/v1/admin/marketplaces/published-product-ids')
      .then((res) => {
        if (res.success && res.data) {
          const byChannel: Record<string, Set<number>> = {};
          for (const [ch, ids] of Object.entries(res.data)) {
            byChannel[ch] = new Set(ids);
          }
          setPublishedIds(byChannel);
        }
      });
  }, [publishResults]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (showOnlyUnpublished) params.set('notPublishedOn', targetMarketplace);

    apiClient.get<ProductForMarketplace[]>(`/api/v1/admin/products?${params}`).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) {
        setProducts(res.data);
        setTotal(res.pagination?.total || 0);
      } else {
        toast.error('Не вдалося завантажити товари');
      }
      setProductsCompletedKey(productsRequestKey);
    });
    return () => {
      cancelled = true;
    };
  }, [page, limit, debouncedSearch, showOnlyUnpublished, targetMarketplace, productsRequestKey]);

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

  const isConfigured = marketplaceStatuses[targetMarketplace] === true;
  const publishedOnTarget = publishedIds[targetMarketplace] || new Set();

  const cancelRef = useRef(false);

  type PublishResult = { id: number; name: string; status: string; error?: string };

  const PARALLEL = 3;

  const publishMany = async (productIds: number[]) => {
    if (productIds.length === 0) return;

    if (!isConfigured) {
      toast.error(
        `${MARKETPLACE_BY_KEY[targetMarketplace]?.name} не налаштовано. Перейдіть на вкладку "Налаштування API".`,
      );
      return;
    }

    cancelRef.current = false;
    setIsPublishing(true);
    setPublishResults([]);
    setPublishProgress({ current: 0, total: productIds.length });

    const results: PublishResult[] = [];
    let cursor = 0;
    let done = 0;

    const worker = async () => {
      while (true) {
        if (cancelRef.current) return;
        const i = cursor++;
        if (i >= productIds.length) return;
        const productId = productIds[i];
        const product = products.find((p) => p.id === productId);

        try {
          const res = await apiClient.post(`/api/v1/admin/products/${productId}/marketplaces`, {
            channel: targetMarketplace,
          });
          results.push({
            id: productId,
            name: product?.name || `#${productId}`,
            status: res.success ? 'ok' : 'error',
            error: res.success ? undefined : res.error || 'Помилка',
          });
        } catch (err) {
          results.push({
            id: productId,
            name: product?.name || `#${productId}`,
            status: 'error',
            error: err instanceof Error ? err.message : 'Помилка',
          });
        }
        done++;
        setPublishProgress({ current: done, total: productIds.length });
      }
    };

    // Run PARALLEL workers concurrently — each pulls the next index from the
    // shared cursor. Caps fanout so we don't slam the marketplace API.
    await Promise.all(Array.from({ length: Math.min(PARALLEL, productIds.length) }, worker));

    setPublishResults(results);
    const successCount = results.filter((r) => r.status === 'ok').length;
    const failCount = results.filter((r) => r.status === 'error').length;
    const cancelled = cancelRef.current;
    const mpName = MARKETPLACE_BY_KEY[targetMarketplace]?.name;

    if (cancelled) {
      toast.info(`Скасовано. Встигли: ${successCount} ok, ${failCount} помилок`);
    } else {
      if (successCount > 0) toast.success(`Опубліковано ${successCount} товарів на ${mpName}`);
      if (failCount > 0) toast.error(`${failCount} товарів не вдалось опублікувати`);
    }

    setIsPublishing(false);
    setSelected(new Set());
    setPublishProgress({ current: 0, total: 0 });
    cancelRef.current = false;
  };

  const handlePublish = async () => {
    setConfirmPublish(false);
    await publishMany(Array.from(selected));
  };

  const handleRetryFailed = () => {
    const failedIds = publishResults.filter((r) => r.status === 'error').map((r) => r.id);
    if (failedIds.length === 0) return;
    void publishMany(failedIds);
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  // Stats
  const statsPerMarketplace = MARKETPLACES.map((m) => ({
    ...m,
    published: publishedIds[m.key]?.size || 0,
    configured: marketplaceStatuses[m.key] === true,
  }));

  return (
    <div>
      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statsPerMarketplace.map((m) => (
          <div
            key={m.key}
            onClick={() => {
              if (isPublishing) return;
              setTargetMarketplace(m.key);
            }}
            className={`rounded-xl border px-4 py-3 transition-all ${
              isPublishing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-sm'
            } ${
              targetMarketplace === m.key
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                : 'border-[var(--color-border)] bg-[var(--color-bg)]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{m.icon}</span>
              <span className="text-sm font-semibold">{m.name}</span>
              {!m.configured && (
                <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                  Не налашт.
                </span>
              )}
            </div>
            <p className="mt-1 text-2xl font-bold">{m.published}</p>
            <p className="text-[10px] text-[var(--color-text-secondary)]">опубліковано</p>
          </div>
        ))}
      </div>

      {/* Sync prices button */}
      {isConfigured && (publishedIds[targetMarketplace]?.size || 0) > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setIsSyncing(true);
              const res = await apiClient.post<{ updated: number; failed: number }>(
                '/api/v1/admin/marketplaces/sync-prices',
                { channel: targetMarketplace },
              );
              if (res.success && res.data) {
                toast.success(
                  `Синхронізовано: ${res.data.updated} оновлено, ${res.data.failed} помилок`,
                );
              } else {
                toast.error(res.error || 'Помилка синхронізації');
              }
              setIsSyncing(false);
            }}
            isLoading={isSyncing}
          >
            Синхронізувати ціни на {MARKETPLACE_BY_KEY[targetMarketplace]?.name}
          </Button>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Оновить ціни та залишки для {publishedIds[targetMarketplace]?.size || 0} товарів
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Download XLSX through a hidden link to keep the export call
              // server-streamed (matches /api/v1/admin/export pattern).
              const url = `/api/v1/admin/marketplaces/export?type=listings&platform=${targetMarketplace}`;
              window.location.href = url;
            }}
            title="Експорт активних listings у Excel"
          >
            📥 Експорт XLSX
          </Button>
        </div>
      )}

      {/* Not configured warning */}
      {!isConfigured && (
        <div className="mb-4 flex items-center gap-3 rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-4 py-3">
          <svg
            className="h-5 w-5 shrink-0 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">
              {MARKETPLACE_BY_KEY[targetMarketplace]?.name} не налаштовано
            </p>
            <p className="text-xs text-amber-600">
              Перейдіть на вкладку &quot;Налаштування API&quot; щоб додати API ключі
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Пошук товару..."
          className="w-64"
        />
        <select
          value={targetMarketplace}
          onChange={(e) => setTargetMarketplace(e.target.value)}
          disabled={isPublishing}
          title={isPublishing ? 'Не можна змінювати маркетплейс під час публікації' : undefined}
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {MARKETPLACES.map((m) => (
            <option key={m.key} value={m.key}>
              {m.icon} {m.name}
            </option>
          ))}
        </select>
        <Button
          onClick={() => selected.size > 0 && setConfirmPublish(true)}
          disabled={selected.size === 0 || isPublishing || !isConfigured}
          isLoading={isPublishing}
        >
          Опублікувати ({selected.size})
        </Button>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={showOnlyUnpublished}
            onChange={(e) => setShowOnlyUnpublished(e.target.checked)}
            className="accent-[var(--color-primary)]"
          />
          Тільки не опубліковані
        </label>
      </div>

      {/* Progress bar */}
      {isPublishing && publishProgress.total > 0 && (
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
            <span>Публікація (паралельно {PARALLEL})...</span>
            <div className="flex items-center gap-3">
              <span>
                {publishProgress.current} / {publishProgress.total}
              </span>
              <button
                onClick={handleCancel}
                className="rounded border border-red-300 px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-50"
              >
                Скасувати
              </button>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
              style={{ width: `${(publishProgress.current / publishProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Publish results */}
      {publishResults.length > 0 && (
        <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              Результати: {publishResults.filter((r) => r.status === 'ok').length} ok ·{' '}
              {publishResults.filter((r) => r.status === 'error').length} помилок
            </p>
            <div className="flex items-center gap-2">
              {publishResults.some((r) => r.status === 'error') && !isPublishing && (
                <button
                  onClick={handleRetryFailed}
                  className="rounded border border-[var(--color-primary)] px-2 py-0.5 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
                >
                  ↻ Повторити невдалі
                </button>
              )}
              <button
                onClick={() => setPublishResults([])}
                className="text-xs text-[var(--color-text-secondary)] hover:underline"
              >
                Закрити
              </button>
            </div>
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {publishResults.map((r) => (
              <div
                key={r.id}
                className={`flex items-center gap-2 text-xs ${r.status === 'ok' ? 'text-green-700' : 'text-red-600'}`}
              >
                <span>{r.status === 'ok' ? '✅' : '❌'}</span>
                <span className="truncate">{r.name}</span>
                {r.error && (
                  <span className="ml-auto shrink-0 text-[var(--color-text-secondary)]">
                    {r.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product table */}
      {isLoading ? (
        <AdminTableSkeleton rows={10} columns={7} />
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
                  <th className="px-4 py-3 text-right font-medium">Ціна</th>
                  <th className="px-4 py-3 text-center font-medium">Залишок</th>
                  <th className="px-4 py-3 text-center font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  // `showOnlyUnpublished` is applied server-side now, so we
                  // don't filter here — the server already returned only
                  // matching rows, and any client filter would shrink the
                  // page (e.g. last page might show <limit) and break the
                  // pagination math below.
                  const isPublished = publishedOnTarget.has(p.id);
                  return (
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
                          <span className="font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{p.code}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {p.category?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">{Number(p.priceRetail).toFixed(2)} ₴</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={
                            p.quantity === 0 ? 'font-medium text-[var(--color-danger)]' : ''
                          }
                        >
                          {p.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isPublished ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Опублік.
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
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
              <PageSizeSelector
                value={limit}
                onChange={(size) => {
                  setLimit(size);
                  setPage(1);
                }}
              />
            </div>
            {total > limit && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Назад
                </Button>
                <span className="px-2 py-1 text-sm text-[var(--color-text-secondary)]">
                  {page} / {Math.ceil(total / limit)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={products.length < limit}
                >
                  Далі
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={confirmPublish}
        onClose={() => setConfirmPublish(false)}
        onConfirm={handlePublish}
        title="Публікація на маркетплейс"
        message={`Опублікувати ${selected.size} товарів на ${MARKETPLACE_BY_KEY[targetMarketplace]?.name}?`}
        confirmText="Так, опублікувати"
      />
    </div>
  );
}
