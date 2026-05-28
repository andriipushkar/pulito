'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
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

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
};

export default function MarketplaceReturnsPage() {
  const t = useTranslations('admin.marketplaceReturnsPage');
  const STATUS_OPTIONS = [
    { value: '', label: t('statusAll') },
    { value: 'pending', label: t('statusPending') },
    { value: 'approved', label: t('statusApproved') },
    { value: 'rejected', label: t('statusRejected') },
    { value: 'completed', label: t('statusCompleted') },
  ];
  const PLATFORM_OPTIONS = [
    { value: '', label: t('platformAll') },
    { value: 'olx', label: 'OLX' },
    { value: 'rozetka', label: 'Rozetka' },
    { value: 'prom', label: 'Prom.ua' },
    { value: 'epicentrk', label: 'Epicentr K' },
  ];
  const STATUS_LABELS: Record<string, string> = {
    pending: t('statusPending'),
    approved: t('statusApproved'),
    rejected: t('statusRejected'),
    completed: t('statusCompleted'),
  };
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
      toast.error(t('loadError'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        restockProducts = window.confirm(t('restockConfirm'));
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
        const parts: string[] = [t('statusUpdated')];
        if (res.data?.restocked) parts.push(t('stockSummary', { count: res.data.restocked }));
        if (res.data?.pushWarning) {
          toast.info(
            t('marketplaceWarn', { prefix: parts.join(' · '), warning: res.data.pushWarning }),
          );
        } else {
          toast.success(parts.join(' · '));
        }
        fetchReturns();
      } else {
        toast.error(t('updateError'));
      }
    } catch {
      toast.error(t('updateError'));
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
        toast.success(t('syncedToast', { count: res.data.synced }));
        fetchReturns();
      } else {
        toast.error(res.error || t('syncError'));
      }
    } catch {
      toast.error(t('syncError'));
    } finally {
      setSyncing(false);
    }
  };

  const handleExportCsv = () => {
    const rows = [
      [
        'id',
        'platform',
        'externalReturnId',
        'orderNumber',
        'reason',
        'status',
        'quantity',
        'refundAmount',
        'createdAt',
      ],
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
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{t('totalLabel', { count: total })}</span>
          <Button size="sm" variant="outline" onClick={handleSync} isLoading={syncing}>
            {t('sync')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            disabled={returns.length === 0}
          >
            {t('csv')}
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
        <div className="py-12 text-center text-gray-500">{t('noReturns')}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200" data-testid="returns-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('colId')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('colMarketplace')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('colExternalId')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('colOrder')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('colReason')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('colStatus')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  {t('colAmount')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('colDate')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('colActions')}
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
                              {t('approveBtn')}
                            </Button>
                            <Button
                              size="xs"
                              variant="danger"
                              onClick={() => handleStatusUpdate(ret.id, 'rejected')}
                            >
                              {t('rejectBtn')}
                            </Button>
                          </>
                        )}
                        {ret.status === 'approved' && (
                          <Button
                            size="xs"
                            variant="primary"
                            onClick={() => handleStatusUpdate(ret.id, 'completed')}
                          >
                            {t('completeBtn')}
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
            {t('prev')}
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
            {t('next')}
          </Button>
        </div>
      )}
    </div>
  );
}
