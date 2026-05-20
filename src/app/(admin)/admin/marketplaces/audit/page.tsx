'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';

interface WebhookLogRow {
  id: number;
  source: string;
  event: string;
  payload: unknown;
  statusCode: number | null;
  error: string | null;
  processedAt: string;
  durationMs: number | null;
}

const MARKETPLACES = [
  { key: 'olx', name: 'OLX', icon: '🟢' },
  { key: 'rozetka', name: 'Rozetka', icon: '🟩' },
  { key: 'prom', name: 'Prom.ua', icon: '🔵' },
  { key: 'epicentrk', name: 'Epicentr K', icon: '🟠' },
];

export default function MarketplaceAuditPage() {
  const [logs, setLogs] = useState<WebhookLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterMp, setFilterMp] = useState('');
  const [filterEvent, setFilterEvent] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'ok' | 'error'>('');
  const [filterSince, setFilterSince] = useState<'' | '1d' | '7d' | '30d'>('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  // isLoading is derived from a request key vs the last completed key to
  // avoid a synchronous setIsLoading(true) in the fetch effect.
  const requestKey = `${page}|${filterMp}|${filterEvent}|${filterStatus}|${filterSince}`;
  const [completedKey, setCompletedKey] = useState<string | null>(null);
  const isLoading = completedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (filterMp) params.set('source', filterMp);
    if (filterEvent) params.set('event', filterEvent);
    if (filterStatus) params.set('status', filterStatus);
    if (filterSince) {
      const days = filterSince === '1d' ? 1 : filterSince === '7d' ? 7 : 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      params.set('since', since);
    }
    apiClient
      .get<WebhookLogRow[]>(`/api/v1/admin/marketplaces/webhook-log?${params}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setLogs(res.data);
          setTotal(res.pagination?.total || 0);
        }
        setCompletedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [page, filterMp, filterEvent, filterStatus, filterSince, requestKey]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/marketplaces"
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          ← Маркетплейси
        </Link>
        <h2 className="mt-1 text-xl font-bold">Журнал webhook-подій</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Останні запити, що прийшли від маркетплейсів. Зберігаються 30 днів.
        </p>
      </div>

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
          value={filterEvent}
          onChange={(e) => {
            setFilterEvent(e.target.value);
            setPage(1);
          }}
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
        >
          <option value="">Всі типи подій</option>
          <option value="order.created">order.created</option>
          <option value="order.updated">order.updated</option>
          <option value="return.created">return.created</option>
          <option value="return.updated">return.updated</option>
          <option value="listing.approved">listing.approved</option>
          <option value="listing.rejected">listing.rejected</option>
          <option value="message.received">message.received</option>
          <option value="unknown">unknown</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value as '' | 'ok' | 'error');
            setPage(1);
          }}
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
        >
          <option value="">Всі статуси</option>
          <option value="ok">Успішні</option>
          <option value="error">З помилками</option>
        </select>
        <select
          value={filterSince}
          onChange={(e) => {
            setFilterSince(e.target.value as '' | '1d' | '7d' | '30d');
            setPage(1);
          }}
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
        >
          <option value="">Весь період</option>
          <option value="1d">Останні 24 год</option>
          <option value="7d">7 днів</option>
          <option value="30d">30 днів</option>
        </select>
        <span className="text-xs text-[var(--color-text-secondary)]">Всього: {total}</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-12 text-center text-[var(--color-text-secondary)]">
          Подій не зафіксовано
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => {
            const mp = MARKETPLACES.find((m) => m.key === log.source);
            const isExpanded = expanded.has(log.id);
            return (
              <div
                key={log.id}
                className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span>{mp?.icon || '📦'}</span>
                  <span className="font-medium">{mp?.name || log.source}</span>
                  <code className="rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-xs">
                    {log.event}
                  </code>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {formatDate(log.processedAt)}
                  </span>
                  {log.error && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                      ❌ {log.error.slice(0, 100)}
                    </span>
                  )}
                  <button
                    onClick={() => toggleExpand(log.id)}
                    className="ml-auto text-xs text-[var(--color-text-secondary)] hover:underline"
                  >
                    {isExpanded ? 'Згорнути' : 'Payload'}
                  </button>
                </div>
                {isExpanded && log.payload != null && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-[var(--color-bg-secondary)] px-2 py-1 text-[11px]">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}

      {total > 50 && (
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
            disabled={logs.length < 50}
          >
            Далі
          </Button>
        </div>
      )}
    </div>
  );
}
