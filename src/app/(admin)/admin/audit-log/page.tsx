'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PageSizeSelector from '@/components/admin/PageSizeSelector';

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

const ACTION_OPTIONS = [
  { value: '', label: 'Всі типи' },
  { value: 'login', label: 'Вхід' },
  { value: 'logout', label: 'Вихід' },
  { value: 'order_status_change', label: 'Зміна статусу' },
  { value: 'import', label: 'Імпорт' },
  { value: 'role_change', label: 'Зміна ролі' },
  { value: 'publication_create', label: 'Публікація' },
  { value: 'theme_change', label: 'Зміна теми' },
  { value: 'page_edit', label: 'Редагування сторінки' },
  { value: 'data_delete', label: 'Видалення' },
  { value: 'user_block', label: 'Блокування' },
  { value: 'user_unblock', label: 'Розблокування' },
  { value: 'user_edit', label: 'Редагування користувача' },
  { value: 'password_reset', label: 'Скидання пароля' },
  { value: 'wholesale_approve', label: 'Схвалення оптовика' },
  { value: 'wholesale_reject', label: 'Відхилення оптовика' },
];

const ENTITY_OPTIONS = [
  { value: '', label: 'Всі об\'єкти' },
  { value: 'order', label: 'Замовлення' },
  { value: 'product', label: 'Товар' },
  { value: 'user', label: 'Користувач' },
  { value: 'category', label: 'Категорія' },
  { value: 'page', label: 'Сторінка' },
  { value: 'settings', label: 'Налаштування' },
];

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ipSearch, setIpSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(20);

  const loadLogs = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (actionFilter) params.set('actionType', actionFilter);
    if (entityFilter) params.set('entityType', entityFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (ipSearch) params.set('ipAddress', ipSearch);

    apiClient
      .get<AuditEntry[]>(`/api/v1/admin/audit-log?${params}`)
      .then((res) => {
        if (res.success && res.data) {
          setLogs(res.data);
          setTotal((res as unknown as { pagination?: { total: number } }).pagination?.total || 0);
        }
      })
      .finally(() => setIsLoading(false));
  }, [page, limit, actionFilter, entityFilter, dateFrom, dateTo, ipSearch]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const resetFilters = () => {
    setActionFilter('');
    setEntityFilter('');
    setDateFrom('');
    setDateTo('');
    setIpSearch('');
    setPage(1);
  };

  const exportCsv = () => {
    if (logs.length === 0) return;
    const header = 'ID,Дата,Користувач,Email,Тип дії,Об\'єкт,ID об\'єкта,IP';
    const rows = logs.map((l) =>
      [l.id, l.createdAt, l.user?.fullName || '', l.user?.email || '', l.actionType, l.entityType || '', l.entityId || '', l.ipAddress || ''].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters = actionFilter || entityFilter || dateFrom || dateTo || ipSearch;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Журнал дій</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? 'Сховати фільтри' : 'Фільтри'}
            {hasActiveFilters ? ' *' : ''}
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={logs.length === 0}>
            Експорт CSV
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-medium">Тип дії</label>
              <select
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
              >
                {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Тип об&apos;єкта</label>
              <select
                value={entityFilter}
                onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
              >
                {ENTITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <Input label="Дата з" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            <Input label="Дата по" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
            <Input label="IP адреса" value={ipSearch} onChange={(e) => { setIpSearch(e.target.value); setPage(1); }} placeholder="Пошук по IP..." />
          </div>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="mt-3 text-xs text-[var(--color-primary)] hover:underline">
              Скинути фільтри
            </button>
          )}
        </div>
      )}

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
                  <th className="px-4 py-2 text-left font-medium">Деталі</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-2 text-xs whitespace-nowrap">{new Date(log.createdAt).toLocaleString('uk-UA')}</td>
                    <td className="px-4 py-2 text-xs">{log.user?.fullName || log.user?.email || 'Система'}</td>
                    <td className="px-4 py-2">
                      <span className="rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-xs font-medium">
                        {ACTION_OPTIONS.find((a) => a.value === log.actionType)?.label || log.actionType}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">{log.entityType ? `${log.entityType} #${log.entityId}` : '—'}</td>
                    <td className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">{log.ipAddress || '—'}</td>
                    <td className="px-4 py-2 text-xs max-w-[200px] truncate text-[var(--color-text-secondary)]">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <PageSizeSelector value={limit} onChange={(size) => { setLimit(size); setPage(1); }} />
            {total > limit && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Попередня</Button>
                <span className="text-sm text-[var(--color-text-secondary)]">Стор. {page} з {Math.ceil(total / limit)}</span>
                <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(page + 1)}>Наступна</Button>
              </div>
            )}
          </div>

          {logs.length === 0 && (
            <div className="py-8 text-center text-[var(--color-text-secondary)]">Журнал порожній</div>
          )}
        </>
      )}
    </div>
  );
}
