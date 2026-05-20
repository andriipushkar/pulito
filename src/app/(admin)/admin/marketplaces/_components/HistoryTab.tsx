'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';
import { MARKETPLACES } from '../_shared';

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
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

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

  const handleRetry = async (pubId: number, channel: string) => {
    const key = `${pubId}:${channel}`;
    setRetrying((prev) => ({ ...prev, [key]: true }));
    const res = await apiClient.post(`/api/v1/admin/publications/${pubId}/retry`, { channel });
    if (res.success) {
      toast.success(`Повторено публікацію на ${MARKETPLACES.find((m) => m.key === channel)?.name || channel}`);
      loadHistory();
    } else {
      toast.error(res.error || 'Не вдалося повторити публікацію');
    }
    setRetrying((prev) => ({ ...prev, [key]: false }));
  };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { pubId, channel, externalId } = confirmDelete;
    const key = `${pubId}:${channel}`;
    setConfirmDelete(null);
    setDeleting((prev) => ({ ...prev, [key]: true }));
    const url = `/api/v1/admin/marketplaces/${channel}?channel=${encodeURIComponent(channel)}&externalId=${encodeURIComponent(externalId)}`;
    const res = await apiClient.delete(url);
    if (res.success) {
      toast.success(`Знято з ${MARKETPLACES.find((m) => m.key === channel)?.name || channel}`);
      loadHistory();
    } else {
      toast.error(res.error || 'Не вдалося видалити з маркетплейсу');
    }
    setDeleting((prev) => ({ ...prev, [key]: false }));
  };

  const toggleSelected = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleBulkRetry = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    let ok = 0;
    let fail = 0;
    for (const key of Array.from(selected)) {
      const [pubIdStr, channel] = key.split(':');
      const pubId = Number(pubIdStr);
      if (!pubId || !channel) continue;
      const res = await apiClient.post(`/api/v1/admin/publications/${pubId}/retry`, { channel });
      if (res.success) ok++;
      else fail++;
    }
    setBulkBusy(false);
    setSelected(new Set());
    loadHistory();
    if (ok > 0) toast.success(`Повторено: ${ok}`);
    if (fail > 0) toast.error(`З помилкою: ${fail}`);
  };

  const handleBulkDelete = async () => {
    setConfirmBulkDelete(false);
    if (selected.size === 0) return;
    setBulkBusy(true);
    let ok = 0;
    let fail = 0;
    for (const key of Array.from(selected)) {
      const [, channel] = key.split(':');
      // Find externalId from current items
      const [pubIdStr, ch] = key.split(':');
      const pub = items.find((p) => p.id === Number(pubIdStr));
      const cr = pub?.channelResults?.find((c) => c.channel === ch);
      if (!cr?.externalId) {
        fail++;
        continue;
      }
      const url = `/api/v1/admin/marketplaces/${channel}?channel=${encodeURIComponent(channel)}&externalId=${encodeURIComponent(cr.externalId)}`;
      const res = await apiClient.delete(url);
      if (res.success) ok++;
      else fail++;
    }
    setBulkBusy(false);
    setSelected(new Set());
    loadHistory();
    if (ok > 0) toast.success(`Знято з продажу: ${ok}`);
    if (fail > 0) toast.error(`З помилкою: ${fail}`);
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

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
              title={selectedFailedCount === 0 ? 'Виберіть провалені публікації' : `Повторити: ${selectedFailedCount}`}
            >
              Повторити ({selectedFailedCount})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedPublishedCount === 0 || bulkBusy}
              onClick={() => setConfirmBulkDelete(true)}
              title={selectedPublishedCount === 0 ? 'Виберіть опубліковані лістинги' : `Зняти: ${selectedPublishedCount}`}
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
                                  {MARKETPLACES.find((m) => m.key === cr.channel)?.name || cr.channel}
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
            ? `Видалити "${confirmDelete.title}" з ${MARKETPLACES.find((m) => m.key === confirmDelete.channel)?.name || confirmDelete.channel}? Лістинг буде видалено на маркетплейсі. Цю дію не можна скасувати.`
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
