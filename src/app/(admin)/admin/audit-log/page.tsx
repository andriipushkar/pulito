'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';

interface AuditEntry {
  id: number;
  actionType: string;
  entityType: string | null;
  entityId: number | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: string;
  user: { fullName: string | null; email: string } | null;
}

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const limit = 20;

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (actionFilter) params.set('actionType', actionFilter);

    apiClient
      .get<AuditEntry[]>(`/api/v1/admin/audit-log?${params}`)
      .then((res) => {
        if (res.success && res.data) {
          setLogs(res.data);
          setTotal((res as unknown as { pagination?: { total: number } }).pagination?.total || 0);
        }
      })
      .finally(() => setIsLoading(false));
  }, [page, actionFilter]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Журнал дій</h2>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
        >
          <option value="">Всі типи</option>
          <option value="login">Вхід</option>
          <option value="logout">Вихід</option>
          <option value="order_status_change">Зміна статусу</option>
          <option value="import">Імпорт</option>
          <option value="role_change">Зміна ролі</option>
          <option value="publication">Публікація</option>
          <option value="theme_change">Зміна теми</option>
          <option value="page_edit">Редагування сторінки</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="md" /></div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg-secondary)]">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Дата</th>
                  <th className="px-4 py-2 text-left font-medium">Користувач</th>
                  <th className="px-4 py-2 text-left font-medium">Дія</th>
                  <th className="px-4 py-2 text-left font-medium">Об&apos;єкт</th>
                  <th className="px-4 py-2 text-left font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-2 text-xs">{new Date(log.createdAt).toLocaleString('uk-UA')}</td>
                    <td className="px-4 py-2 text-xs">{log.user?.fullName || log.user?.email || 'Система'}</td>
                    <td className="px-4 py-2 text-xs">{log.actionType}</td>
                    <td className="px-4 py-2 text-xs">{log.entityType ? `${log.entityType} #${log.entityId}` : '—'}</td>
                    <td className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">{log.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > limit && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Попередня</Button>
              <span className="text-sm text-[var(--color-text-secondary)]">Стор. {page} з {Math.ceil(total / limit)}</span>
              <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(page + 1)}>Наступна</Button>
            </div>
          )}

          {logs.length === 0 && (
            <div className="py-8 text-center text-[var(--color-text-secondary)]">Журнал порожній</div>
          )}
        </>
      )}
    </div>
  );
}
