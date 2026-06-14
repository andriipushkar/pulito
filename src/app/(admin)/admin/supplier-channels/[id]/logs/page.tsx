'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';

interface SyncLog {
  id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  itemsTotal: number;
  itemsUpdated: number;
  itemsUnmatched: number;
  errorLog: { message?: string } | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const statusLabel: Record<SyncLog['status'], { text: string; cls: string }> = {
  completed: { text: 'успішно', cls: 'bg-green-100 text-green-700' },
  failed: { text: 'помилка', cls: 'bg-red-100 text-red-700' },
  running: { text: 'виконується', cls: 'bg-blue-100 text-blue-700' },
  pending: { text: 'очікує', cls: 'bg-gray-100 text-gray-500' },
};

export default function SupplierSyncLogsPage() {
  const params = useParams<{ id: string }>();
  const channelId = Number(params.id);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<SyncLog[]>(
        `/api/v1/admin/supplier-channels/${channelId}/sync-logs`,
      );
      if (res.success && res.data) setLogs(res.data);
      else toast.error(res.error || 'Не вдалося завантажити лог');
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    if (!isNaN(channelId)) load();
  }, [channelId, load]);

  const dt = (s: string | null) => (s ? new Date(s).toLocaleString('uk-UA') : '—');

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Історія синхронізацій — канал #{channelId}</h1>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Кожен рядок — один запуск синку: скільки оновлено, без пари, і чому впав.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            Оновити
          </Button>
          <Link href="/admin/import" className="text-sm text-[var(--color-primary)] underline">
            ← До каналів
          </Link>
        </div>
      </div>

      {loading && <div className="text-sm text-[var(--color-text-secondary)]">Завантаження…</div>}

      {!loading && (
        <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-2 py-2 text-left">Час</th>
                <th className="px-2 py-2 text-left">Статус</th>
                <th className="px-2 py-2 text-right">У фіді</th>
                <th className="px-2 py-2 text-right">Оновлено</th>
                <th className="px-2 py-2 text-right">Без пари</th>
                <th className="px-2 py-2 text-left">Помилка</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-2 py-4 text-center text-[var(--color-text-secondary)]"
                  >
                    Синків ще не було
                  </td>
                </tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-2 py-2 text-xs">{dt(l.completedAt || l.createdAt)}</td>
                  <td className="px-2 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${statusLabel[l.status].cls}`}
                    >
                      {statusLabel[l.status].text}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">{l.itemsTotal}</td>
                  <td className="px-2 py-2 text-right">{l.itemsUpdated}</td>
                  <td className="px-2 py-2 text-right">{l.itemsUnmatched}</td>
                  <td className="px-2 py-2 text-xs text-red-600">{l.errorLog?.message ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
