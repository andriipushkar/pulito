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

interface PaginatedResponse {
  success: boolean;
  data: MarketplaceReturn[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const STATUS_OPTIONS = [
  { value: '', label: 'Всі статуси' },
  { value: 'pending', label: 'Очікує' },
  { value: 'approved', label: 'Підтверджено' },
  { value: 'rejected', label: 'Відхилено' },
  { value: 'completed', label: 'Завершено' },
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

      const res = await apiClient.get<PaginatedResponse>(
        `/api/v1/admin/marketplaces/returns?${params.toString()}`,
      );

      if (res.success && res.data) {
        const data = res.data as unknown as PaginatedResponse;
        setReturns(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      }
    } catch {
      toast.error('Помилка завантаження повернень');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const handleStatusUpdate = async (id: number, newStatus: string) => {
    setUpdating(id);
    try {
      const res = await apiClient.patch(`/api/v1/admin/marketplaces/returns/${id}`, {
        status: newStatus,
      });
      if (res.success) {
        toast.success('Статус оновлено');
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Повернення з маркетплейсів</h1>
        <span className="text-sm text-gray-500">Всього: {total}</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
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
