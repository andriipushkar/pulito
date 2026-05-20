'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';
import PageSizeSelector from '@/components/admin/PageSizeSelector';
import { DEFAULT_PAGE_SIZE } from '@/config/admin-constants';

interface MarketplaceReturn {
  id: number;
  externalReturnId: string;
  reason: string | null;
  status: string;
  quantity: number;
  refundAmount: number | null;
  createdAt: string;
  connection: { platform: string };
  order: { id: number; orderNumber: string } | null;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Всі статуси' },
  { value: 'pending', label: 'Очікує' },
  { value: 'approved', label: 'Підтверджено' },
  { value: 'rejected', label: 'Відхилено' },
  { value: 'completed', label: 'Завершено' },
];

const PLATFORM_OPTIONS = [
  { value: '', label: 'Всі маркетплейси' },
  { value: 'olx', label: 'OLX' },
  { value: 'rozetka', label: 'Rozetka' },
  { value: 'prom', label: 'Prom.ua' },
  { value: 'epicentrk', label: 'Epicentr K' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Очікує',
  approved: 'Підтверджено',
  rejected: 'Відхилено',
  completed: 'Завершено',
};

export default function MarketplaceReturnsPage() {
  const [returns, setReturns] = useState<MarketplaceReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (statusFilter) params.set('status', statusFilter);
      if (platformFilter) params.set('platform', platformFilter);

      const res = await apiClient.get<MarketplaceReturn[]>(
        `/api/v1/admin/marketplaces/returns?${params.toString()}`,
      );

      if (res.success && res.data) {
        setReturns(res.data);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages);
          setTotal(res.pagination.total);
        }
      }
    } catch {
      toast.error('Помилка завантаження повернень');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, platformFilter]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const [syncing, setSyncing] = useState(false);

  const handleStatusUpdate = async (id: number, newStatus: string) => {
    // Ask about restock only when completing a return that has a linked order.
    let restockProducts = false;
    if (newStatus === 'completed') {
      const ret = returns.find((r) => r.id === id);
      if (ret?.order) {
        restockProducts = window.confirm(
          'Повернути товари з цього замовлення на склад? Це збільшить локальний залишок і запушить його на всі маркетплейси.',
        );
      }
    }

    setUpdating(id);
    try {
      const res = await apiClient.patch<{
        pushWarning: string | null;
        restocked: number;
      }>(`/api/v1/admin/marketplaces/returns/${id}`, {
        status: newStatus,
        restockProducts,
      });
      if (res.success) {
        const parts: string[] = ['Статус оновлено'];
        if (res.data?.restocked) parts.push(`склад: +${res.data.restocked} позицій`);
        if (res.data?.pushWarning) {
          toast.info(`${parts.join(' · ')}. Маркетплейс: ${res.data.pushWarning}`);
        } else {
          toast.success(parts.join(' · '));
        }
        fetchReturns();
      } else {
        toast.error('Помилка оновлення статусу');
      }
    } catch {
      toast.error('Помилка оновлення статусу');
    } finally {
      setUpdating(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await apiClient.post<{ synced: number; perPlatform: Record<string, number> }>(
        '/api/v1/admin/marketplaces/returns',
      );
      if (res.success && res.data) {
        toast.success(`Синхронізовано: +${res.data.synced} нових`);
        fetchReturns();
      } else {
        toast.error(res.error || 'Помилка синхронізації');
      }
    } catch {
      toast.error('Помилка синхронізації');
    } finally {
      setSyncing(false);
    }
  };

  const handleExportCsv = () => {
    const rows = [
      ['id', 'platform', 'externalReturnId', 'orderNumber', 'reason', 'status', 'quantity', 'refundAmount', 'createdAt'],
      ...returns.map((r) => [
        String(r.id),
        r.connection.platform,
        r.externalReturnId,
        r.order?.orderNumber || '',
        (r.reason || '').replace(/[\r\n]+/g, ' '),
        r.status,
        String(r.quantity),
        r.refundAmount != null ? r.refundAmount.toFixed(2) : '',
        r.createdAt,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(','),
      )
      .join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marketplace-returns-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Повернення з маркетплейсів</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Всього: {total}</span>
          <Button size="sm" variant="outline" onClick={handleSync} isLoading={syncing}>
            ↻ Синхронізувати
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportCsv} disabled={returns.length === 0}>
            ⬇ CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          data-testid="status-filter"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={platformFilter}
          onChange={(e) => {
            setPlatformFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          data-testid="platform-filter"
        >
          {PLATFORM_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <PageSizeSelector
          value={pageSize}
          onChange={(v) => {
            setPageSize(v);
            setPage(1);
          }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <AdminTableSkeleton rows={5} columns={9} />
      ) : returns.length === 0 ? (
        <div className="py-12 text-center text-gray-500">Повернень не знайдено</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200" data-testid="returns-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Маркетплейс
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Зовнішній ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Замовлення
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Причина
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Статус
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  Сума
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Дата
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Дії
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {returns.map((ret) => (
                <tr key={ret.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm">{ret.id}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm capitalize">
                    {ret.connection.platform}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-xs">
                    {ret.externalReturnId}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {ret.order ? `#${ret.order.orderNumber}` : '-'}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-sm" title={ret.reason || ''}>
                    {ret.reason || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[ret.status] || 'bg-gray-100 text-gray-800'}`}
                    >
                      {STATUS_LABELS[ret.status] || ret.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    {ret.refundAmount != null ? `${ret.refundAmount.toFixed(2)} грн` : '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {new Date(ret.createdAt).toLocaleDateString('uk-UA')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {updating === ret.id ? (
                      <Spinner size="sm" />
                    ) : (
                      <div className="flex gap-1">
                        {ret.status === 'pending' && (
                          <>
                            <Button
                              size="xs"
                              variant="success"
                              onClick={() => handleStatusUpdate(ret.id, 'approved')}
                            >
                              Підтвердити
                            </Button>
                            <Button
                              size="xs"
                              variant="danger"
                              onClick={() => handleStatusUpdate(ret.id, 'rejected')}
                            >
                              Відхилити
                            </Button>
                          </>
                        )}
                        {ret.status === 'approved' && (
                          <Button
                            size="xs"
                            variant="primary"
                            onClick={() => handleStatusUpdate(ret.id, 'completed')}
                          >
                            Завершити
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Попередня
          </Button>
          <span className="text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Наступна
          </Button>
        </div>
      )}
    </div>
  );
}
