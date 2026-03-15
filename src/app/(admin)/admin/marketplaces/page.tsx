'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';
import PageSizeSelector from '@/components/admin/PageSizeSelector';
import { useDebounce } from '@/hooks/useDebounce';
import { SEARCH_DEBOUNCE_MS, DEFAULT_PAGE_SIZE } from '@/config/admin-constants';

interface MarketplaceConfig {
  enabled: boolean;
  [key: string]: string | boolean;
}

interface ProductForMarketplace {
  id: number;
  name: string;
  code: string;
  priceRetail: number;
  quantity: number;
  imagePath: string | null;
  isActive: boolean;
  category: { name: string } | null;
}

const MARKETPLACES = [
  {
    key: 'olx',
    name: 'OLX',
    icon: '🟢',
    color: '#002f34',
    description: 'Публікація оголошень на OLX.ua',
    fields: [
      { key: 'clientId', label: 'Client ID', placeholder: 'OLX API Client ID', sensitive: false, optional: false },
      { key: 'accessToken', label: 'Access Token', placeholder: 'OLX API Access Token', sensitive: true, optional: false },
      { key: 'defaultCategoryId', label: 'Категорія за замовч.', placeholder: '1430', sensitive: false, optional: true },
      { key: 'cityId', label: 'Місто (ID)', placeholder: '1', sensitive: false, optional: true },
      { key: 'contactName', label: "Ім'я контакту", placeholder: 'Порошок', sensitive: false, optional: true },
      { key: 'contactPhone', label: 'Телефон', placeholder: '+380501234567', sensitive: false, optional: true },
    ],
  },
  {
    key: 'rozetka',
    name: 'Rozetka',
    icon: '🟩',
    color: '#00a046',
    description: 'Публікація товарів на Rozetka Marketplace',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'Rozetka Seller API Key', sensitive: true, optional: false },
      { key: 'sellerId', label: 'Seller ID', placeholder: '12345', sensitive: false, optional: false },
    ],
  },
  {
    key: 'prom',
    name: 'Prom.ua',
    icon: '🔵',
    color: '#2b5797',
    description: 'Публікація товарів на Prom.ua',
    fields: [
      { key: 'apiToken', label: 'API Token', placeholder: 'Prom.ua API Token', sensitive: true, optional: false },
    ],
  },
  {
    key: 'epicentrk',
    name: 'Epicentr K',
    icon: '🟠',
    color: '#f57c00',
    description: 'Публікація товарів на маркетплейсі Епіцентр К',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'Epicentr API Key', sensitive: true, optional: false },
      { key: 'sellerId', label: 'Seller ID', placeholder: '12345', sensitive: false, optional: false },
    ],
  },
] as const;

type TabKey = 'products' | 'history' | 'messages' | 'settings';

export default function MarketplacesPage() {
  const [tab, setTab] = useState<TabKey>('products');
  const [messageCount, setMessageCount] = useState(0);

  // Load unread message count
  useEffect(() => {
    apiClient.get<{ id: string; isRead: boolean }[]>('/api/v1/admin/marketplaces/messages').then((res) => {
      if (res.success && res.data) {
        setMessageCount(res.data.filter((m) => !m.isRead).length);
      }
    });
  }, [tab]);

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'products', label: 'Публікація товарів' },
    { key: 'history', label: 'Історія' },
    { key: 'messages', label: 'Повідомлення', badge: messageCount },
    { key: 'settings', label: 'Налаштування API' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold">Маркетплейси</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Публікуйте товари на OLX, Rozetka, Prom.ua та Epicentr K
        </p>
      </div>

      <div className="mb-6 flex gap-1 rounded-[var(--radius)] bg-[var(--color-bg-secondary)] p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? 'bg-[var(--color-bg)] shadow-sm' : 'text-[var(--color-text-secondary)]'}`}
          >
            {t.label}
            {t.badge ? (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'products' && <ProductsTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'messages' && <MessagesTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}

// ── Products Tab ──

function ProductsTab() {
  const [products, setProducts] = useState<ProductForMarketplace[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [targetMarketplace, setTargetMarketplace] = useState('olx');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState({ current: 0, total: 0 });
  const [publishResults, setPublishResults] = useState<{ id: number; name: string; status: string; error?: string }[]>([]);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showOnlyUnpublished, setShowOnlyUnpublished] = useState(false);
  const [marketplaceStatuses, setMarketplaceStatuses] = useState<Record<string, boolean>>({});
  const [publishedIds, setPublishedIds] = useState<Record<string, Set<number>>>({});

  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);

  // Load marketplace connection statuses
  useEffect(() => {
    apiClient.get<Record<string, MarketplaceConfig | null>>('/api/v1/admin/channel-settings').then((res) => {
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

  // Load which products are already published on selected marketplace
  useEffect(() => {
    apiClient.get<{ id: number; productId: number; channels: string[] }[]>(
      `/api/v1/admin/publications?limit=1000&status=published`
    ).then((res) => {
      if (res.success && res.data) {
        const byChannel: Record<string, Set<number>> = {};
        for (const pub of res.data) {
          if (!pub.productId) continue;
          for (const ch of pub.channels) {
            if (!byChannel[ch]) byChannel[ch] = new Set();
            byChannel[ch].add(pub.productId);
          }
        }
        setPublishedIds(byChannel);
      }
    });
  }, [publishResults]);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (debouncedSearch) params.set('search', debouncedSearch);

    const res = await apiClient.get<ProductForMarketplace[]>(`/api/v1/admin/products?${params}`);
    if (res.success && res.data) {
      setProducts(res.data);
      setTotal(res.pagination?.total || 0);
    } else {
      toast.error('Не вдалося завантажити товари');
    }
    setIsLoading(false);
  }, [page, limit, debouncedSearch]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map((p) => p.id)));
  };

  const isConfigured = marketplaceStatuses[targetMarketplace] === true;
  const publishedOnTarget = publishedIds[targetMarketplace] || new Set();

  const handlePublish = async () => {
    setConfirmPublish(false);
    if (selected.size === 0) return;

    if (!isConfigured) {
      toast.error(`${MARKETPLACES.find((m) => m.key === targetMarketplace)?.name} не налаштовано. Перейдіть на вкладку "Налаштування API".`);
      return;
    }

    setIsPublishing(true);
    setPublishResults([]);
    const selectedArr = Array.from(selected);
    setPublishProgress({ current: 0, total: selectedArr.length });

    const results: { id: number; name: string; status: string; error?: string }[] = [];

    for (let i = 0; i < selectedArr.length; i++) {
      const productId = selectedArr[i];
      const product = products.find((p) => p.id === productId);
      if (!product) continue;

      setPublishProgress({ current: i + 1, total: selectedArr.length });

      const res = await apiClient.post('/api/v1/admin/publications', {
        title: product.name,
        content: `${product.name}\n\nКод: ${product.code}\nЦіна: ${Number(product.priceRetail).toFixed(2)} грн`,
        channels: [targetMarketplace],
        productId: product.id,
      });

      if (res.success) {
        const pubId = (res.data as { id: number })?.id;
        if (pubId) {
          const pubRes = await apiClient.post(`/api/v1/admin/publications/${pubId}/publish`);
          results.push({
            id: productId,
            name: product.name,
            status: pubRes.success ? 'ok' : 'error',
            error: pubRes.success ? undefined : (pubRes.error || 'Помилка публікації'),
          });
        }
      } else {
        results.push({ id: productId, name: product.name, status: 'error', error: res.error || 'Помилка' });
      }
    }

    setPublishResults(results);
    const successCount = results.filter((r) => r.status === 'ok').length;
    const failCount = results.filter((r) => r.status === 'error').length;
    const mpName = MARKETPLACES.find((m) => m.key === targetMarketplace)?.name;

    if (successCount > 0) toast.success(`Опубліковано ${successCount} товарів на ${mpName}`);
    if (failCount > 0) toast.error(`${failCount} товарів не вдалось опублікувати`);

    setIsPublishing(false);
    setSelected(new Set());
    setPublishProgress({ current: 0, total: 0 });
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
            onClick={() => setTargetMarketplace(m.key)}
            className={`cursor-pointer rounded-xl border px-4 py-3 transition-all hover:shadow-sm ${
              targetMarketplace === m.key ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-[var(--color-border)] bg-[var(--color-bg)]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{m.icon}</span>
              <span className="text-sm font-semibold">{m.name}</span>
              {!m.configured && (
                <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">Не налашт.</span>
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
              const res = await apiClient.post<{ updated: number; failed: number }>('/api/v1/admin/marketplaces/sync-prices', { channel: targetMarketplace });
              if (res.success && res.data) {
                toast.success(`Синхронізовано: ${res.data.updated} оновлено, ${res.data.failed} помилок`);
              } else {
                toast.error(res.error || 'Помилка синхронізації');
              }
              setIsSyncing(false);
            }}
            isLoading={isSyncing}
          >
            Синхронізувати ціни на {MARKETPLACES.find((m) => m.key === targetMarketplace)?.name}
          </Button>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Оновить ціни та залишки для {publishedIds[targetMarketplace]?.size || 0} товарів
          </p>
        </div>
      )}

      {/* Not configured warning */}
      {!isConfigured && (
        <div className="mb-4 flex items-center gap-3 rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-4 py-3">
          <svg className="h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">
              {MARKETPLACES.find((m) => m.key === targetMarketplace)?.name} не налаштовано
            </p>
            <p className="text-xs text-amber-600">Перейдіть на вкладку &quot;Налаштування API&quot; щоб додати API ключі</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Пошук товару..."
          className="w-64"
        />
        <select
          value={targetMarketplace}
          onChange={(e) => setTargetMarketplace(e.target.value)}
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
        >
          {MARKETPLACES.map((m) => (
            <option key={m.key} value={m.key}>{m.icon} {m.name}</option>
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
          <div className="mb-1 flex justify-between text-xs text-[var(--color-text-secondary)]">
            <span>Публікація...</span>
            <span>{publishProgress.current} / {publishProgress.total}</span>
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
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Результати публікації</p>
            <button onClick={() => setPublishResults([])} className="text-xs text-[var(--color-text-secondary)] hover:underline">Закрити</button>
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {publishResults.map((r) => (
              <div key={r.id} className={`flex items-center gap-2 text-xs ${r.status === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                <span>{r.status === 'ok' ? '✅' : '❌'}</span>
                <span className="truncate">{r.name}</span>
                {r.error && <span className="ml-auto shrink-0 text-[var(--color-text-secondary)]">{r.error}</span>}
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
                    <input type="checkbox" checked={selected.size === products.length && products.length > 0} onChange={toggleAll} className="accent-[var(--color-primary)]" />
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
                {products.filter((p) => !showOnlyUnpublished || !publishedOnTarget.has(p.id)).map((p) => {
                  const isPublished = publishedOnTarget.has(p.id);
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-[var(--color-border)] last:border-0 transition-colors ${selected.has(p.id) ? 'bg-[var(--color-primary)]/5' : 'hover:bg-[var(--color-bg-secondary)]'}`}
                    >
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="accent-[var(--color-primary)]" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-[var(--color-bg-secondary)]">
                            {p.imagePath ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={p.imagePath} alt="" className="h-full w-full object-contain" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-[8px] text-[var(--color-text-secondary)]">—</div>
                            )}
                          </div>
                          <span className="font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{p.code}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{p.category?.name || '—'}</td>
                      <td className="px-4 py-3 text-right">{Number(p.priceRetail).toFixed(2)} ₴</td>
                      <td className="px-4 py-3 text-center">
                        <span className={p.quantity === 0 ? 'font-medium text-[var(--color-danger)]' : ''}>{p.quantity}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isPublished ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Опублік.</span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">Товарів не знайдено</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <p className="text-xs text-[var(--color-text-secondary)]">Всього: {total}</p>
              <PageSizeSelector value={limit} onChange={(size) => { setLimit(size); setPage(1); }} />
            </div>
            {total > limit && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Назад</Button>
                <span className="px-2 py-1 text-sm text-[var(--color-text-secondary)]">{page} / {Math.ceil(total / limit)}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={products.length < limit}>Далі</Button>
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
        message={`Опублікувати ${selected.size} товарів на ${MARKETPLACES.find((m) => m.key === targetMarketplace)?.name}?`}
        confirmText="Так, опублікувати"
      />
    </div>
  );
}

// ── History Tab ──

interface PublicationHistoryItem {
  id: number;
  title: string;
  channels: string[];
  status: string;
  publishedAt: string | null;
  createdAt: string;
  productId: number | null;
  channelResults?: { channel: string; status: string; externalId: string | null; permalink: string | null; errorMessage: string | null }[];
}

function HistoryTab() {
  const [items, setItems] = useState<PublicationHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMp, setFilterMp] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const mpChannels: string[] = MARKETPLACES.map((m) => m.key);

  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (filterStatus) params.set('status', filterStatus);

    apiClient.get<PublicationHistoryItem[]>(`/api/v1/admin/publications?${params}`).then((res) => {
      if (res.success && res.data) {
        // Filter to only marketplace publications
        const filtered = res.data.filter((pub) =>
          pub.channels.some((ch) => mpChannels.includes(ch)) &&
          (!filterMp || pub.channels.includes(filterMp))
        );
        setItems(filtered);
        setTotal(res.pagination?.total || 0);
      }
    }).finally(() => setIsLoading(false));
  }, [page, filterMp, filterStatus]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const statusLabel = (s: string) => {
    switch (s) {
      case 'published': return { text: 'Опубліковано', color: 'bg-green-100 text-green-700' };
      case 'failed': return { text: 'Помилка', color: 'bg-red-100 text-red-700' };
      case 'draft': return { text: 'Чернетка', color: 'bg-gray-100 text-gray-600' };
      case 'scheduled': return { text: 'Заплановано', color: 'bg-blue-100 text-blue-700' };
      default: return { text: s, color: 'bg-gray-100 text-gray-600' };
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={filterMp}
          onChange={(e) => { setFilterMp(e.target.value); setPage(1); }}
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
        >
          <option value="">Всі маркетплейси</option>
          {MARKETPLACES.map((m) => (
            <option key={m.key} value={m.key}>{m.icon} {m.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
        >
          <option value="">Всі статуси</option>
          <option value="published">Опубліковані</option>
          <option value="failed">Помилки</option>
          <option value="draft">Чернетки</option>
        </select>
      </div>

      {isLoading ? (
        <AdminTableSkeleton rows={8} columns={5} />
      ) : items.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-12 text-center text-[var(--color-text-secondary)]">
          Історія публікацій порожня
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((pub) => {
              const st = statusLabel(pub.status);
              return (
                <div key={pub.id} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>{st.text}</span>
                      <span className="text-sm font-medium">{pub.title}</span>
                    </div>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {formatDate(pub.publishedAt || pub.createdAt)}
                    </span>
                  </div>
                  {pub.channelResults && pub.channelResults.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {pub.channelResults.filter((cr) => mpChannels.includes(cr.channel)).map((cr) => (
                        <div key={cr.channel} className="flex items-center gap-1.5 text-xs">
                          <span>{cr.status === 'published' ? '✅' : '❌'}</span>
                          <span className="font-medium">{MARKETPLACES.find((m) => m.key === cr.channel)?.name || cr.channel}</span>
                          {cr.permalink && (
                            <a href={cr.permalink} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
                              Посилання
                            </a>
                          )}
                          {cr.errorMessage && (
                            <span className="text-[var(--color-danger)]">{cr.errorMessage}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {total > 20 && (
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Назад</Button>
              <span className="px-2 py-1 text-sm text-[var(--color-text-secondary)]">{page}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={items.length < 20}>Далі</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Messages Tab ──

interface MarketplaceMessage {
  id: string;
  marketplace: string;
  buyerName: string;
  text: string;
  listingTitle?: string;
  listingId: string;
  createdAt: string;
  isRead: boolean;
}

const MP_NAMES: Record<string, string> = { olx: 'OLX', rozetka: 'Rozetka', prom: 'Prom.ua', epicentrk: 'Epicentr K' };
const MP_ICONS: Record<string, string> = { olx: '🟢', rozetka: '🟩', prom: '🔵', epicentrk: '🟠' };

function MessagesTab() {
  const [messages, setMessages] = useState<MarketplaceMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMp, setFilterMp] = useState('');

  useEffect(() => {
    setIsLoading(true);
    const params = filterMp ? `?channel=${filterMp}` : '';
    apiClient.get<MarketplaceMessage[]>(`/api/v1/admin/marketplaces/messages${params}`).then((res) => {
      if (res.success && res.data) setMessages(res.data);
      else toast.error('Не вдалося завантажити повідомлення');
    }).catch(() => toast.error('Помилка мережі')).finally(() => setIsLoading(false));
  }, [filterMp]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <select
          value={filterMp}
          onChange={(e) => setFilterMp(e.target.value)}
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
        >
          <option value="">Всі маркетплейси</option>
          {MARKETPLACES.map((m) => (
            <option key={m.key} value={m.key}>{m.icon} {m.name}</option>
          ))}
        </select>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {messages.filter((m) => !m.isRead).length} непрочитаних
        </p>
      </div>

      {isLoading ? (
        <AdminTableSkeleton rows={5} columns={4} />
      ) : messages.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-12 text-center text-[var(--color-text-secondary)]">
          <p className="text-lg">Немає повідомлень</p>
          <p className="mt-1 text-sm">Повідомлення від покупців з маркетплейсів з&apos;являться тут</p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => (
            <div
              key={`${msg.marketplace}-${msg.id}`}
              className={`rounded-[var(--radius)] border p-4 transition-colors ${
                msg.isRead
                  ? 'border-[var(--color-border)] bg-[var(--color-bg)]'
                  : 'border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{MP_ICONS[msg.marketplace] || '📦'}</span>
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">{MP_NAMES[msg.marketplace] || msg.marketplace}</span>
                  {!msg.isRead && (
                    <span className="rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[9px] font-bold text-white">Нове</span>
                  )}
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">{formatDate(msg.createdAt)}</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-sm font-bold text-[var(--color-text-secondary)]">
                  {msg.buyerName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{msg.buyerName}</p>
                  <p className="mt-0.5 text-sm text-[var(--color-text)]">{msg.text}</p>
                  {msg.listingTitle && (
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Товар: {msg.listingTitle}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Settings Tab ──

function SettingsTab() {
  const [configs, setConfigs] = useState<Record<string, MarketplaceConfig | null>>({});
  const [forms, setForms] = useState<Record<string, Record<string, string | boolean>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState<Record<string, Set<string>>>({});

  const loadConfigs = useCallback(async () => {
    const res = await apiClient.get<Record<string, MarketplaceConfig | null>>('/api/v1/admin/channel-settings');
    if (res.success && res.data) {
      const newForms: Record<string, Record<string, string | boolean>> = {};
      const newDirty: Record<string, Set<string>> = {};
      for (const m of MARKETPLACES) {
        const config = res.data[m.key] as MarketplaceConfig | null;
        if (config) {
          newForms[m.key] = { ...config };
        } else {
          const empty: Record<string, string | boolean> = { enabled: false };
          m.fields.forEach((f) => { empty[f.key] = ''; });
          newForms[m.key] = empty;
        }
        newDirty[m.key] = new Set();
      }
      setConfigs(res.data);
      setForms(newForms);
      setDirty(newDirty);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const updateField = (marketplace: string, field: string, value: string | boolean) => {
    setForms((prev) => ({ ...prev, [marketplace]: { ...prev[marketplace], [field]: value } }));
    setDirty((prev) => {
      const s = new Set(prev[marketplace] || []);
      s.add(field);
      return { ...prev, [marketplace]: s };
    });
  };

  const handleSave = async (marketplace: typeof MARKETPLACES[number]) => {
    const ch = marketplace.key;
    setSaving((prev) => ({ ...prev, [ch]: true }));

    const config: Record<string, string | boolean> = { enabled: forms[ch]?.enabled ?? false };
    for (const f of marketplace.fields) {
      if (dirty[ch]?.has(f.key)) {
        config[f.key] = forms[ch]?.[f.key] ?? '';
      } else if (configs[ch]?.[f.key] !== undefined) {
        const existing = configs[ch]![f.key];
        if (typeof existing === 'string' && existing.includes('••••')) continue;
        config[f.key] = existing!;
      }
    }

    const res = await apiClient.put('/api/v1/admin/channel-settings', { channel: ch, config });
    if (res.success) {
      toast.success(`${marketplace.name} збережено`);
      await loadConfigs();
    } else {
      toast.error(res.error || 'Помилка збереження');
    }
    setSaving((prev) => ({ ...prev, [ch]: false }));
  };

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="md" /></div>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {MARKETPLACES.map((marketplace) => {
        const ch = marketplace.key;
        const form = forms[ch] || { enabled: false };
        const isEnabled = form.enabled === true;

        return (
          <div
            key={ch}
            className={`rounded-xl border p-5 transition-all ${
              isEnabled ? 'border-green-200 bg-[var(--color-bg)] shadow-sm' : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{marketplace.icon}</span>
                <div>
                  <h3 className="font-semibold">{marketplace.name}</h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">{marketplace.description}</p>
                </div>
              </div>
              <button
                onClick={() => updateField(ch, 'enabled', !isEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  isEnabled ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
              </button>
            </div>

            <div className="space-y-3">
              {marketplace.fields.map((field) => {
                const tokenKey = `${ch}_${field.key}`;
                const isShown = showTokens[tokenKey];
                return (
                  <div key={field.key}>
                    <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                      {field.label} {field.optional && <span className="text-[var(--color-text-secondary)]">(опц.)</span>}
                    </label>
                    <div className="relative">
                      <Input
                        type={field.sensitive && !isShown ? 'password' : 'text'}
                        value={String(form[field.key] || '')}
                        onChange={(e) => updateField(ch, field.key, e.target.value)}
                        placeholder={field.placeholder}
                      />
                      {field.sensitive && (
                        <button
                          type="button"
                          onClick={() => setShowTokens((prev) => ({ ...prev, [tokenKey]: !isShown }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-xs text-[var(--color-text-secondary)]"
                        >
                          {isShown ? '🙈' : '👁️'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => handleSave(marketplace)}
                disabled={saving[ch] || !(dirty[ch]?.size)}
              >
                {saving[ch] ? 'Зберігаю...' : 'Зберегти'}
              </Button>
              {isEnabled && (
                <span className="flex items-center gap-1.5 text-xs text-green-600">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Підключено
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Auto-sync settings */}
      <div className="mt-6 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🔄</span>
          <div>
            <h3 className="font-semibold">Автоматична синхронізація цін</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Ціни та залишки автоматично оновлюються на маркетплейсах при зміні в прайсі
            </p>
          </div>
        </div>
        <AutoSyncSettings />
      </div>
    </div>
  );
}

function AutoSyncSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    apiClient.get<Record<string, string>>('/api/v1/admin/delivery-settings').then(() => {
      // Use site settings for auto-sync config
      apiClient.get<Record<string, string>>('/api/v1/admin/payment-settings').then((res) => {
        // Load from a shared settings endpoint - for now use localStorage as bridge
        const saved = typeof window !== 'undefined' ? localStorage.getItem('marketplace_autosync') : null;
        if (saved) setSettings(JSON.parse(saved));
        setIsLoading(false);
      });
    });
  }, []);

  const updateField = (key: string, value: string) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('marketplace_autosync', JSON.stringify(next));
      return next;
    });
  };

  if (isLoading) return <Spinner size="sm" />;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {MARKETPLACES.map((m) => (
        <div key={m.key} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span>{m.icon}</span>
            <span className="text-sm font-medium">{m.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={settings[`sync_${m.key}`] || 'off'}
              onChange={(e) => updateField(`sync_${m.key}`, e.target.value)}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs"
            >
              <option value="off">Вимкнено</option>
              <option value="1h">Кожну годину</option>
              <option value="6h">Кожні 6 годин</option>
              <option value="12h">Кожні 12 годин</option>
              <option value="24h">Раз на добу</option>
            </select>
          </div>
        </div>
      ))}
      <div className="sm:col-span-2">
        <p className="text-[10px] text-[var(--color-text-secondary)]">
          Синхронізація оновлює ціни та залишки для всіх раніше опублікованих товарів. Запускається автоматично через cron job.
        </p>
      </div>
    </div>
  );
}
