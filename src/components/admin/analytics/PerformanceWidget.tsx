'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';

interface MetricData {
  date: string;
  route: string;
  metric: string;
  p50: number;
  p75: number;
  p90: number;
  sampleCount: number;
}

const METRIC_THRESHOLDS: Record<string, { good: number; poor: number; unit: string }> = {
  LCP: { good: 2500, poor: 4000, unit: 'ms' },
  FID: { good: 100, poor: 300, unit: 'ms' },
  CLS: { good: 0.1, poor: 0.25, unit: '' },
  TTFB: { good: 800, poor: 1800, unit: 'ms' },
  INP: { good: 200, poor: 500, unit: 'ms' },
  FCP: { good: 1800, poor: 3000, unit: 'ms' },
};

function getColor(metric: string, value: number): string {
  const threshold = METRIC_THRESHOLDS[metric];
  if (!threshold) return 'var(--color-text)';
  if (value <= threshold.good) return '#10b981';
  if (value <= threshold.poor) return '#f59e0b';
  return '#ef4444';
}

function getLabel(metric: string, value: number): string {
  const threshold = METRIC_THRESHOLDS[metric];
  if (!threshold) return '';
  if (value <= threshold.good) return 'Good';
  if (value <= threshold.poor) return 'Needs improvement';
  return 'Poor';
}

export default function PerformanceWidget({ days = 30 }: { days?: number }) {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<MetricData[]>(`/api/v1/admin/analytics/performance?days=${days}`)
      .then((res) => {
        if (res.success && res.data) setMetrics(res.data);
      })
      .finally(() => setIsLoading(false));
  }, [days]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  if (metrics.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-center text-sm text-[var(--color-text-secondary)]">
        Немає даних про продуктивність за обраний період
      </div>
    );
  }

  // Aggregate: latest p75 per metric (across all routes)
  const latestByMetric: Record<string, MetricData> = {};
  for (const m of metrics) {
    const existing = latestByMetric[m.metric];
    if (!existing || new Date(m.date) > new Date(existing.date)) {
      latestByMetric[m.metric] = m;
    }
  }

  const metricOrder = ['LCP', 'FID', 'INP', 'CLS', 'TTFB', 'FCP'];
  const orderedMetrics = metricOrder
    .filter((name) => latestByMetric[name])
    .map((name) => latestByMetric[name]);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {orderedMetrics.map((m) => {
          const threshold = METRIC_THRESHOLDS[m.metric];
          const color = getColor(m.metric, m.p75);
          const label = getLabel(m.metric, m.p75);

          return (
            <div
              key={m.metric}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">{m.metric}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: color + '20', color }}
                >
                  {label}
                </span>
              </div>

              <p className="text-2xl font-bold" style={{ color }}>
                {m.metric === 'CLS' ? m.p75.toFixed(3) : Math.round(m.p75)}
                {threshold?.unit && (
                  <span className="ml-1 text-sm font-normal text-[var(--color-text-secondary)]">
                    {threshold.unit}
                  </span>
                )}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">p75</p>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--color-border)] pt-3 text-xs">
                <div>
                  <p className="text-[var(--color-text-secondary)]">p50</p>
                  <p className="font-medium">
                    {m.metric === 'CLS' ? m.p50.toFixed(3) : Math.round(m.p50)}
                  </p>
                </div>
                <div>
                  <p className="text-[var(--color-text-secondary)]">p90</p>
                  <p className="font-medium">
                    {m.metric === 'CLS' ? m.p90.toFixed(3) : Math.round(m.p90)}
                  </p>
                </div>
                <div>
                  <p className="text-[var(--color-text-secondary)]">Samples</p>
                  <p className="font-medium">{m.sampleCount}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
