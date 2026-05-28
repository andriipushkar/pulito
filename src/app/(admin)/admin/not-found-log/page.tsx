'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

interface NotFoundLogRow {
  id: number;
  path: string;
  referrer: string | null;
  userAgent: string | null;
  count: number;
  firstSeen: string;
  lastSeenAt: string;
}

interface PaginatedResponse {
  items: NotFoundLogRow[];
  total: number;
  page: number;
  limit: number;
}

export default function NotFoundLogPage() {
  const t = useTranslations('admin.notFoundLog');
  const [logs, setLogs] = useState<NotFoundLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'lastSeen' | 'count'>('lastSeen');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .get<PaginatedResponse>(`/api/v1/admin/not-found-log?limit=200&sort=${sort}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setLogs(res.data.items);
          setTotal(res.data.total);
        } else {
          toast.error(res.error || t('loadError'));
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sort, t]);

  const deleteOne = async (id: number) => {
    const res = await apiClient.delete(`/api/v1/admin/not-found-log?id=${id}`);
    if (res.success) {
      setLogs((prev) => prev.filter((l) => l.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    } else {
      toast.error(res.error || t('deleteError'));
    }
  };

  const clearAll = async () => {
    if (!window.confirm(t('confirmClear', { total }))) return;
    const res = await apiClient.delete('/api/v1/admin/not-found-log?confirm=all');
    if (res.success) {
      setLogs([]);
      setTotal(0);
      toast.success(t('cleared'));
    } else {
      toast.error(res.error || t('clearError'));
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{t('title')}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('intro')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'lastSeen' | 'count')}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          >
            <option value="lastSeen">{t('sortRecent')}</option>
            <option value="count">{t('sortMostFrequent')}</option>
          </select>
          {logs.length > 0 && (
            <Button variant="outline" onClick={clearAll}>
              {t('clearAll')}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-8 text-center text-sm text-[var(--color-text-secondary)]">
          {t('empty')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-secondary)] text-xs uppercase text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-3 py-2 text-left">{t('colPath')}</th>
                <th className="px-3 py-2 text-right">{t('colHits')}</th>
                <th className="px-3 py-2 text-left">{t('colLast')}</th>
                <th className="px-3 py-2 text-left">{t('colReferrer')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2 font-mono text-xs">
                    <a
                      href={log.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[var(--color-primary)]"
                    >
                      {log.path}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{log.count}</td>
                  <td className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                    {new Date(log.lastSeenAt).toLocaleString('uk-UA')}
                  </td>
                  <td className="max-w-xs truncate px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                    {log.referrer || '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => deleteOne(log.id)}
                      className="text-xs text-[var(--color-danger)] hover:underline"
                    >
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
