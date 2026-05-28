'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

interface WarehouseRef {
  id: number;
  name: string;
  code: string;
}

interface TransferListItem {
  id: number;
  reference: string;
  status: 'draft' | 'in_transit' | 'completed' | 'cancelled';
  fromWarehouse: WarehouseRef;
  toWarehouse: WarehouseRef;
  items: { id: number; quantity: number }[];
  createdAt: string;
  comment: string | null;
}

const STATUS_COLORS: Record<TransferListItem['status'], string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  in_transit: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

export default function WarehouseTransfersPage() {
  const tr = useTranslations('admin.warehouseTransfers');
  const STATUS_LABELS: Record<TransferListItem['status'], string> = {
    draft: tr('statusDraft'),
    in_transit: tr('statusInTransit'),
    completed: tr('statusCompleted'),
    cancelled: tr('statusCancelled'),
  };
  const [transfers, setTransfers] = useState<TransferListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const load = async () => {
    setLoading(true);
    const qs = statusFilter ? `?status=${statusFilter}` : '';
    const res = await apiClient.get<{ items: TransferListItem[]; total: number }>(
      `/api/v1/admin/warehouse-transfers${qs}`,
    );
    if (res.success && res.data) setTransfers(res.data.items ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const totalQty = (items: { quantity: number }[]) => items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{tr('title')}</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">{tr('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          >
            <option value="">{tr('allStatuses')}</option>
            <option value="draft">{tr('statusDraft')}</option>
            <option value="in_transit">{tr('statusInTransit')}</option>
            <option value="completed">{tr('statusCompleted')}</option>
            <option value="cancelled">{tr('statusCancelled')}</option>
          </select>
          <Link href="/admin/warehouse-transfers/new">
            <Button>{tr('newDocument')}</Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : transfers.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-12 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">{tr('empty')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <th className="px-4 py-3 text-left font-medium">{tr('colNumber')}</th>
                <th className="px-4 py-3 text-left font-medium">{tr('colRoute')}</th>
                <th className="px-4 py-3 text-left font-medium">{tr('colStatus')}</th>
                <th className="px-4 py-3 text-right font-medium">{tr('colPositions')}</th>
                <th className="px-4 py-3 text-left font-medium">{tr('colDate')}</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => (
                <tr
                  key={transfer.id}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/warehouse-transfers/${transfer.id}`}
                      className="font-mono font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {transfer.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[var(--color-text)]">{transfer.fromWarehouse.name}</span>
                    <span className="mx-2 text-[var(--color-text-secondary)]">→</span>
                    <span className="text-[var(--color-text)]">{transfer.toWarehouse.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[transfer.status]}`}
                    >
                      {STATUS_LABELS[transfer.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {transfer.items.length} / {totalQty(transfer.items)}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {new Date(transfer.createdAt).toLocaleString('uk-UA', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
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
