'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { formatPrice } from '@/utils/format';

type Dimension = 'status' | 'clientType' | 'deliveryMethod' | 'paymentMethod' | 'monthYear';
type Metric = 'orderCount' | 'totalRevenue' | 'avgCheck';

interface ReportRow {
  dimension: string;
  orderCount?: number;
  totalRevenue?: number;
  avgCheck?: number;
}

export default function ReportBuilderPage() {
  const t = useTranslations('admin.reportBuilderPage');
  const DIM_LABELS: Record<Dimension, string> = {
    status: t('dimStatus'),
    clientType: t('dimClientType'),
    deliveryMethod: t('dimDeliveryMethod'),
    paymentMethod: t('dimPaymentMethod'),
    monthYear: t('dimMonthYear'),
  };
  const METRIC_LABELS: Record<Metric, string> = {
    orderCount: t('metricOrderCount'),
    totalRevenue: t('metricTotalRevenue'),
    avgCheck: t('metricAvgCheck'),
  };
  const [dimension, setDimension] = useState<Dimension>('status');
  const [metrics, setMetrics] = useState<Set<Metric>>(new Set(['orderCount', 'totalRevenue']));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const toggleMetric = (m: Metric) => {
    setMetrics((s) => {
      const next = new Set(s);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  };

  const run = async () => {
    if (metrics.size === 0) {
      toast.error(t('selectMetricError'));
      return;
    }
    setIsLoading(true);
    const res = await apiClient.post<{ rows: ReportRow[] }>('/api/v1/admin/reports/builder', {
      dimension,
      metrics: Array.from(metrics),
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
    setIsLoading(false);
    if (res.success && res.data) {
      setRows(res.data.rows);
    } else {
      toast.error(res.error || t('errorGeneric'));
    }
  };

  const exportCsv = () => {
    const cols = ['dimension', ...Array.from(metrics)];
    const header = [t('csvDimension'), ...Array.from(metrics).map((m) => METRIC_LABELS[m])];
    const body = rows.map((r) =>
      cols.map((c) => {
        const v = (r as unknown as Record<string, unknown>)[c];
        if (v === undefined || v === null) return '';
        return String(v).replace(/,/g, ';');
      }),
    );
    const csv = [header, ...body].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${dimension}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <p className="text-xs text-[var(--color-text-secondary)]">{t('intro')}</p>
      </div>

      <div className="grid gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--color-text-secondary)]">
            {t('dimensionLabel')}
          </label>
          <Select
            value={dimension}
            onChange={(e) => setDimension(e.target.value as Dimension)}
            options={Object.entries(DIM_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--color-text-secondary)]">
            {t('dateFromLabel')}
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--color-text-secondary)]">
            {t('dateToLabel')}
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--color-text-secondary)]">
            {t('metricsLabel')}
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(METRIC_LABELS) as [Metric, string][]).map(([m, l]) => (
              <button
                key={m}
                onClick={() => toggleMetric(m)}
                className={`rounded-full px-3 py-1 text-xs ${
                  metrics.has(m)
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'border border-[var(--color-border)] bg-[var(--color-bg-secondary)]'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={run} disabled={isLoading}>
          {isLoading ? t('runComputing') : t('run')}
        </Button>
        {rows.length > 0 && (
          <Button variant="outline" onClick={exportCsv}>
            {t('exportCsv')}
          </Button>
        )}
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-secondary)] text-left text-xs uppercase text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-4 py-3">{DIM_LABELS[dimension]}</th>
                {Array.from(metrics).map((m) => (
                  <th key={m} className="px-4 py-3 text-right">
                    {METRIC_LABELS[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-2 font-medium">{row.dimension}</td>
                  {metrics.has('orderCount') && (
                    <td className="px-4 py-2 text-right">{row.orderCount}</td>
                  )}
                  {metrics.has('totalRevenue') && (
                    <td className="px-4 py-2 text-right">{formatPrice(row.totalRevenue ?? 0)}</td>
                  )}
                  {metrics.has('avgCheck') && (
                    <td className="px-4 py-2 text-right">{formatPrice(row.avgCheck ?? 0)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
