'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';
import { MARKETPLACES, MARKETPLACE_BY_KEY } from '../_shared';

interface PublicationHistoryItem {
  id: number;
  title: string;
  channels: string[];
  status: string;
  publishedAt: string | null;
  createdAt: string;
  productId: number | null;
  channelResults?: {
    channel: string;
    status: string;
    externalId: string | null;
    permalink: string | null;
    errorMessage: string | null;
  }[];
}

export function HistoryTab() {
  const [items, setItems] = useState<PublicationHistoryItem[]>([]);
  const [filterMp, setFilterMp] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [retrying, setRetrying] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<{
    pubId: number;
    channel: string;
    externalId: string;
    title: string;
  } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set()); // "pubId:channel" keys
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkAction, setBulkAction] = useState<'retry' | 'delete' | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const bulkCancelRef = useRef(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Worker pool cap. Same value as ProductsTab.publishMany — keeps fan-out
  // to the marketplace APIs predictable across all bulk surfaces.
  const BULK_PARALLEL = 3;

  const mpChannels = useMemo<string[]>(() => MARKETPLACES.map((m) => m.key), []);

  // isLoading is derived from a request key (changes whenever inputs that
  // trigger the fetch change) vs the last completed key, so we never need a
  // synchronous setIsLoading(true) inside the effect.
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${page}|${filterMp}|${filterStatus}|${reloadToken}`;
  const [completedKey, setCompletedKey] = useState<string | null>(null);
  const isLoading = completedKey !== requestKey;
  const loadHistory = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (filterStatus) params.set('status', filterStatus);

    apiClient
      .get<PublicationHistoryItem[]>(`/api/v1/admin/publications?${params}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          const filtered = res.data.filter(
            (pub) =>
              pub.channels.some((ch) => mpChannels.includes(ch)) &&
              (!filterMp || pub.channels.includes(filterMp)),
          );
          setItems(filtered);
          setTotal(res.pagination?.total || 0);
        }
      })
      .finally(() => {
        if (!cancelled) setCompletedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [page, filterMp, filterStatus, mpChannels, requestKey]);

  // Synchronous in-flight guard. React's setState is async, so two clicks
  // within the same tick both see `disabled={retrying[key]}` as false. A
  // ref-backed Set updates immediately and blocks the duplicate request.
  const retryInFlight = useRef<Set<string>>(new Set());

  const handleRetry = async (pubId: number, channel: string) => {
    const key = `${pubId}:${channel}`;
    if (retryInFlight.current.has(key)) return;
    retryInFlight.current.add(key);
    setRetrying((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await apiClient.post(`/api/v1/admin/publications/${pubId}/retry`, { channel });
      if (res.success) {
        toast.success(`Повторено публікацію на ${MARKETPLACE_BY_KEY[channel]?.name || channel}`);
        loadHistory();
      } else if (res.statusCode === 409) {
        // Server-side idempotency: another retry for the same channel is
        // still running. Don't reload — let the user wait for it.
        toast.info(res.error || 'Публікація на цей канал вже триває');
      } else {
        toast.error(res.error || 'Не вдалося повторити публікацію');
      }
    } finally {
      retryInFlight.current.delete(key);
      setRetrying((prev) => ({ ...prev, [key]: false }));
    }
  };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Same guard pattern as retry: synchronous ref blocks double-click during
  // the React render gap, and 409 from the server is treated as info, not
  // failure (means another tab/click already started this delete).
  const deleteInFlight = useRef<Set<string>>(new Set());

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { pubId, channel, externalId } = confirmDelete;
    const key = `${pubId}:${channel}`;
    setConfirmDelete(null);
    if (deleteInFlight.current.has(key)) return;
    deleteInFlight.current.add(key);
    setDeleting((prev) => ({ ...prev, [key]: true }));
    try {
      const url = `/api/v1/admin/marketplaces/${channel}?channel=${encodeURIComponent(channel)}&externalId=${encodeURIComponent(externalId)}`;
      const res = await apiClient.delete(url);
      if (res.success) {
        toast.success(`Знято з ${MARKETPLACE_BY_KEY[channel]?.name || channel}`);
        loadHistory();
      } else if (res.statusCode === 409) {
        toast.info(res.error || 'Видалення вже виконується');
      } else {
        toast.error(res.error || 'Не вдалося видалити з маркетплейсу');
      }
    } finally {
      deleteInFlight.current.delete(key);
      setDeleting((prev) => ({ ...prev, [key]: false }));
    }
  };

  const toggleSelected = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Generic worker-pool runner shared by bulk Retry and bulk Delete.
  // Each worker pulls the next index from a shared cursor, so finished
  // requests immediately get replaced — no head-of-line blocking.
  // `signal.cancelled` is checked between tasks so an in-flight request still
  // resolves but no new ones are started after the user hits "Скасувати".
  const runBulkPool = async <T,>(
    items: T[],
    worker: (item: T) => Promise<'ok' | 'fail' | 'inProgress'>,
  ): Promise<{ ok: number; fail: number; inProgress: number; cancelled: boolean }> => {
    bulkCancelRef.current = false;
    setBulkProgress({ current: 0, total: items.length });

    let cursor = 0;
    let done = 0;
    let ok = 0;
    let fail = 0;
    let inProgress = 0;

    const tick = async () => {
      while (true) {
        if (bulkCancelRef.current) return;
        const i = cursor++;
        if (i >= items.length) return;
        const r = await worker(items[i]);
        if (r === 'ok') ok++;
        else if (r === 'inProgress') inProgress++;
        else fail++;
        done++;
        setBulkProgress({ current: done, total: items.length });
      }
    };

    const workerCount = Math.min(BULK_PARALLEL, items.length);
    await Promise.all(Array.from({ length: workerCount }, tick));

    const cancelled = bulkCancelRef.current;
    bulkCancelRef.current = false;
    return { ok, fail, inProgress, cancelled };
  };

  const handleBulkRetry = async () => {
    if (selected.size === 0) return;
    const keys = Array.from(selected).filter((key) => {
      const [pubIdStr, channel] = key.split(':');
      return Boolean(Number(pubIdStr)) && Boolean(channel);
    });
    if (keys.length === 0) return;

    setBulkAction('retry');
    setBulkBusy(true);

    const { ok, fail, inProgress, cancelled } = await runBulkPool(keys, async (key) => {
      const [pubIdStr, channel] = key.split(':');
      const pubId = Number(pubIdStr);
      if (retryInFlight.current.has(key)) return 'inProgress';
      retryInFlight.current.add(key);
      try {
        const res = await apiClient.post(`/api/v1/admin/publications/${pubId}/retry`, { channel });
        if (res.success) return 'ok';
        if (res.statusCode === 409) return 'inProgress';
        return 'fail';
      } finally {
        retryInFlight.current.delete(key);
      }
    });

    setBulkBusy(false);
    setBulkAction(null);
    setBulkProgress({ current: 0, total: 0 });
    setSelected(new Set());
    loadHistory();

    if (cancelled) {
      toast.info(`Скасовано. Встигли: ${ok} ok, ${fail} помилок, ${inProgress} вже в роботі`);
      return;
    }
    if (ok > 0) toast.success(`Повторено: ${ok}`);
    if (inProgress > 0) toast.info(`Вже виконується: ${inProgress}`);
    if (fail > 0) toast.error(`З помилкою: ${fail}`);
  };

  const handleBulkDelete = async () => {
    setConfirmBulkDelete(false);
    if (selected.size === 0) return;

    // Resolve externalId up-front so worker only does the network call.
    type DeleteTask = { key: string; channel: string; externalId: string };
    const tasks: DeleteTask[] = [];
    let skippedNoExternalId = 0;
    for (const key of selected) {
      const [pubIdStr, channel] = key.split(':');
      const pub = items.find((p) => p.id === Number(pubIdStr));
      const cr = pub?.channelResults?.find((c) => c.channel === channel);
      if (!cr?.externalId) {
        skippedNoExternalId++;
        continue;
      }
      tasks.push({ key, channel, externalId: cr.externalId });
    }
    if (tasks.length === 0) {
      if (skippedNoExternalId > 0) toast.error('Жоден з вибраних не має externalId');
      return;
    }

    setBulkAction('delete');
    setBulkBusy(true);

    const { ok, fail, cancelled } = await runBulkPool(tasks, async ({ channel, externalId }) => {
      const url = `/api/v1/admin/marketplaces/${channel}?channel=${encodeURIComponent(channel)}&externalId=${encodeURIComponent(externalId)}`;
      const res = await apiClient.delete(url);
      return res.success ? 'ok' : 'fail';
    });

    setBulkBusy(false);
    setBulkAction(null);
    setBulkProgress({ current: 0, total: 0 });
    setSelected(new Set());
    loadHistory();

    const totalFail = fail + skippedNoExternalId;
    if (cancelled) {
      toast.info(`Скасовано. Знято: ${ok}, помилок: ${totalFail}`);
      return;
    }
    if (ok > 0) toast.success(`Знято з продажу: ${ok}`);
    if (totalFail > 0) toast.error(`З помилкою: ${totalFail}`);
  };

  const cancelBulk = () => {
    bulkCancelRef.current = true;
  };

  const selectedFailedCount = useMemo(() => {
    let c = 0;
    for (const key of selected) {
      const [pubIdStr, ch] = key.split(':');
      const pub = items.find((p) => p.id === Number(pubIdStr));
      const cr = pub?.channelResults?.find((c) => c.channel === ch);
      if (cr && cr.status !== 'published') c++;
    }
    return c;
  }, [selected, items]);

  const selectedPublishedCount = useMemo(() => {
    let c = 0;
    for (const key of selected) {
      const [pubIdStr, ch] = key.split(':');
      const pub = items.find((p) => p.id === Number(pubIdStr));
      const cr = pub?.channelResults?.find((c) => c.channel === ch);
      if (cr && cr.status === 'published' && cr.externalId) c++;
    }
    return c;
  }, [selected, items]);

  // Pin to Kyiv time — the shop is run from Lviv and operators reason about
  // pickup/return windows in local time, not the OS timezone of whichever
  // device they happen to be on (e.g. a manager travelling abroad).
  const formatDate = (d: string) =>
    new Date(d).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Kyiv',
    });

  const statusLabel = (s: string) => {
    switch (s) {
      case 'published':
        return { text: 'Опубліковано', color: 'bg-green-100 text-green-700' };
      case 'failed':
        return { text: 'Помилка', color: 'bg-red-100 text-red-700' };
      case 'draft':
        return { text: 'Чернетка', color: 'bg-gray-100 text-gray-600' };
      case 'scheduled':
        return { text: 'Заплановано', color: 'bg-blue-100 text-blue-700' };
      default:
        return { text: s, color: 'bg-gray-100 text-gray-600' };
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={filterMp}
          onChange={(e) => {
            setFilterMp(e.target.value);
            setPage(1);
          }}
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
        >
          <option value="">Всі маркетплейси</option>
          {MARKETPLACES.map((m) => (
            <option key={m.key} value={m.key}>
              {m.icon} {m.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
        >
          <option value="">Всі статуси</option>
          <option value="published">Опубліковані</option>
          <option value="failed">Помилки</option>
          <option value="draft">Чернетки</option>
        </select>
        {selected.size > 0 && (
          <>
            <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
              Вибрано: {selected.size}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedFailedCount === 0 || bulkBusy}
              isLoading={bulkBusy && selectedFailedCount > 0}
              onClick={handleBulkRetry}
              title={
                selectedFailedCount === 0
                  ? 'Виберіть провалені публікації'
                  : `Повторити: ${selectedFailedCount}`
              }
            >
              Повторити ({selectedFailedCount})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedPublishedCount === 0 || bulkBusy}
              onClick={() => setConfirmBulkDelete(true)}
              title={
                selectedPublishedCount === 0
                  ? 'Виберіть опубліковані лістинги'
                  : `Зняти: ${selectedPublishedCount}`
              }
            >
              Зняти з продажу ({selectedPublishedCount})
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-[var(--color-text-secondary)] hover:underline"
            >
              Скинути вибір
            </button>
          </>
        )}
      </div>

      {bulkBusy && bulkProgress.total > 0 && (
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
            <span>
              {bulkAction === 'delete' ? 'Зняття з продажу' : 'Повторна публікація'} (паралельно{' '}
              {BULK_PARALLEL})…
            </span>
            <div className="flex items-center gap-3">
              <span>
                {bulkProgress.current} / {bulkProgress.total}
              </span>
              <button
                onClick={cancelBulk}
                className="rounded border border-red-300 px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-50"
              >
                Скасувати
              </button>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
              style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

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
                <div
                  key={pub.id}
                  className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>
                        {st.text}
                      </span>
                      <span className="text-sm font-medium">{pub.title}</span>
                    </div>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {formatDate(pub.publishedAt || pub.createdAt)}
                    </span>
                  </div>
                  {pub.channelResults && pub.channelResults.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {pub.channelResults
                        .filter((cr) => mpChannels.includes(cr.channel))
                        .map((cr) => {
                          const expandKey = `${pub.id}:${cr.channel}`;
                          const retryKey = `${pub.id}:${cr.channel}`;
                          const isFailed = cr.status !== 'published';
                          const hasError = Boolean(cr.errorMessage);
                          const isExpanded = expanded.has(expandKey);
                          return (
                            <div key={cr.channel} className="text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selected.has(expandKey)}
                                  onChange={() => toggleSelected(expandKey)}
                                  className="accent-[var(--color-primary)]"
                                  title="Вибрати для масової операції"
                                />
                                <span>{cr.status === 'published' ? '✅' : '❌'}</span>
                                <span className="font-medium">
                                  {MARKETPLACE_BY_KEY[cr.channel]?.name || cr.channel}
                                </span>
                                {cr.permalink && (
                                  <a
                                    href={cr.permalink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[var(--color-primary)] hover:underline"
                                  >
                                    Посилання ↗
                                  </a>
                                )}
                                {hasError && (
                                  <button
                                    onClick={() => toggleExpand(expandKey)}
                                    className="text-[var(--color-text-secondary)] hover:underline"
                                  >
                                    {isExpanded ? 'Сховати помилку' : 'Деталі помилки'}
                                  </button>
                                )}
                                <div className="ml-auto flex items-center gap-1.5">
                                  {isFailed && (
                                    <button
                                      onClick={() => handleRetry(pub.id, cr.channel)}
                                      disabled={retrying[retryKey]}
                                      className="rounded border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-medium hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
                                    >
                                      {retrying[retryKey] ? 'Повторюю...' : 'Повторити'}
                                    </button>
                                  )}
                                  {cr.status === 'published' && cr.externalId && (
                                    <button
                                      onClick={() =>
                                        setConfirmDelete({
                                          pubId: pub.id,
                                          channel: cr.channel,
                                          externalId: cr.externalId!,
                                          title: pub.title,
                                        })
                                      }
                                      disabled={deleting[retryKey]}
                                      className="rounded border border-red-200 px-2 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                                    >
                                      {deleting[retryKey] ? 'Видаляю...' : 'Зняти з продажу'}
                                    </button>
                                  )}
                                </div>
                              </div>
                              {hasError && isExpanded && (
                                <pre className="mt-1 max-h-40 overflow-auto rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
                                  {cr.errorMessage}
                                </pre>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {total > 20 && (
            <div className="mt-4 flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Назад
              </Button>
              <span className="px-2 py-1 text-sm text-[var(--color-text-secondary)]">{page}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={items.length < 20}
              >
                Далі
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Зняти з продажу"
        message={
          confirmDelete
            ? `Видалити "${confirmDelete.title}" з ${MARKETPLACE_BY_KEY[confirmDelete.channel]?.name || confirmDelete.channel}? Лістинг буде видалено на маркетплейсі. Цю дію не можна скасувати.`
            : ''
        }
        confirmText="Так, видалити"
      />

      <ConfirmDialog
        isOpen={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={handleBulkDelete}
        title="Масове зняття з продажу"
        message={`Зняти ${selectedPublishedCount} опублікованих лістингів з маркетплейсів? Цю дію не можна скасувати.`}
        confirmText="Так, зняти всі"
        variant="danger"
      />
    </div>
  );
}
