'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface Anomaly {
  metric: string;
  label: string;
  today: number;
  baseline: number;
  deviation: number;
  severity: 'info' | 'warning' | 'danger';
  message: string;
}

const SEVERITY_STYLES = {
  danger: 'border-red-300 bg-red-50',
  warning: 'border-orange-300 bg-orange-50',
  info: 'border-blue-300 bg-blue-50',
};

const SEVERITY_ICON = {
  danger: '🚨',
  warning: '⚠️',
  info: '📈',
};

/**
 * Anomaly detection: compares today's metrics with 14-day baseline.
 * Surfaces unusual sales dips, spikes, cancellation patterns.
 * Hides when no anomalies — owners only see signals worth attention.
 */
export default function AnomaliesWidget() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ anomalies: Anomaly[] }>('/api/v1/admin/anomalies')
      .then((res) => {
        if (!cancelled && res.success && res.data) setAnomalies(res.data.anomalies);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading || anomalies.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {anomalies.map((a) => (
        <div
          key={a.metric}
          className={`flex items-start gap-3 rounded-xl border p-4 ${SEVERITY_STYLES[a.severity]}`}
        >
          <div className="text-2xl">{SEVERITY_ICON[a.severity]}</div>
          <div className="flex-1">
            <h3 className="text-sm font-bold">{a.label}</h3>
            <p className="mt-1 text-sm">{a.message}</p>
            <div className="mt-2 flex gap-4 text-xs text-[var(--color-text-secondary)]">
              <span>
                Сьогодні: <strong>{a.today.toLocaleString('uk-UA')}</strong>
              </span>
              <span>
                Середнє (14д): <strong>{a.baseline.toLocaleString('uk-UA')}</strong>
              </span>
              <span className={`font-bold ${a.deviation > 0 ? 'text-green-700' : 'text-red-700'}`}>
                {a.deviation > 0 ? '+' : ''}
                {a.deviation}%
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
