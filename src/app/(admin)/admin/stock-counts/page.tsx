'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

interface WarehouseRef {
  id: number;
  name: string;
  code: string;
}

interface StockCountListItem {
  id: number;
  reference: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  warehouse: WarehouseRef;
  items: { id: number; countedQty: number | null }[];
  startedAt: string;
  completedAt: string | null;
}

const STATUS_COLORS: Record<StockCountListItem['status'], string> = {
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function StockCountsPage() {
  const t = useTranslations('admin.stockCountsPage');
  const STATUS_LABELS: Record<StockCountListItem['status'], string> = {
    in_progress: t('statusInProgress'),
    completed: t('statusCompleted'),
    cancelled: t('statusCancelled'),
  };
  const router = useRouter();
  const [counts, setCounts] = useState<StockCountListItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [startWarehouseId, setStartWarehouseId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ items: StockCountListItem[]; total: number }>('/api/v1/admin/stock-counts')
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setCounts(res.data.items ?? []);
        else toast.error(res.error || t('loadCountsError'));
      })
      .catch(() => {
        if (!cancelled) toast.error(t('loadCountsError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    apiClient
      .get<WarehouseRef[]>('/api/v1/admin/warehouses')
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setWarehouses(res.data);
        else toast.error(res.error || t('loadWarehousesError'));
      })
      .catch(() => {
        if (!cancelled) toast.error(t('loadWarehousesError'));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    if (!startWarehouseId) {
      setError(t('selectWarehouseError'));
      return;
    }
    setError(null);
    setStarting(true);
    const res = await apiClient.post<{ id: number }>('/api/v1/admin/stock-counts', {
      warehouseId: startWarehouseId,
    });
    setStarting(false);
    if (res.success && res.data) {
      router.push(`/admin/stock-counts/${res.data.id}`);
    } else {
      setError(res.error || t('startError'));
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">{t('intro')}</p>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            {t('startLabel')}
          </label>
          <select
            value={startWarehouseId ?? ''}
            onChange={(e) => setStartWarehouseId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          >
            <option value="">{t('selectWarehouse')}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={start} isLoading={starting}>
          {t('startButton')}
        </Button>
        {error && <span className="text-sm text-[var(--color-danger)]">{error}</span>}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : counts.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-12 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">{t('empty')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <th className="px-4 py-3 text-left font-medium">{t('colNumber')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('colWarehouse')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('colStatus')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('colPositions')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('colStarted')}</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((c) => {
                const counted = c.items.filter((i) => i.countedQty !== null).length;
                return (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/stock-counts/${c.id}`}
                        className="font-mono font-medium text-[var(--color-primary)] hover:underline"
                      >
                        {c.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{c.warehouse.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status]}`}
                      >
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {counted} / {c.items.length}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {new Date(c.startedAt).toLocaleString('uk-UA', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
