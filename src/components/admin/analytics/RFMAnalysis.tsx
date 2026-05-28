'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';

interface RFMSegment {
  segment: string;
  label: string;
  count: number;
  avgRecency: number;
  avgFrequency: number;
  avgMonetary: number;
  color: string;
}

interface RFMData {
  segments: RFMSegment[];
  totalCustomers: number;
}

const SEGMENT_COLORS: Record<string, string> = {
  champions: '#22c55e',
  loyal: '#3b82f6',
  potential_loyal: '#8b5cf6',
  recent: '#06b6d4',
  promising: '#f59e0b',
  needs_attention: '#f97316',
  about_to_sleep: '#ef4444',
  at_risk: '#dc2626',
  hibernating: '#6b7280',
  lost: '#374151',
};

export default function RFMAnalysis({ days }: { days: number }) {
  const t = useTranslations('admin.rfmAnalysis');
  const SEGMENT_LABELS: Record<string, string> = {
    champions: t('segChampions'),
    loyal: t('segLoyal'),
    potential_loyal: t('segPotentialLoyal'),
    recent: t('segRecent'),
    promising: t('segPromising'),
    needs_attention: t('segNeedsAttention'),
    about_to_sleep: t('segAboutToSleep'),
    at_risk: t('segAtRisk'),
    hibernating: t('segHibernating'),
    lost: t('segLost'),
  };
  const [data, setData] = useState<RFMData | null>(null);
  // Derive isLoading from "completed days param matches requested one".
  const [completedDays, setCompletedDays] = useState<number | null>(null);
  const isLoading = completedDays !== days;

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<RFMData>(`/api/v1/admin/analytics/rfm?days=${days}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setData(res.data);
      })
      .finally(() => {
        if (!cancelled) setCompletedDays(days);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (isLoading)
    return (
      <div className="flex justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  if (!data) return <p className="text-sm text-[var(--color-text-secondary)]">{t('noData')}</p>;

  const maxCount = Math.max(...data.segments.map((s) => s.count), 1);

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-2 text-sm font-semibold">{t('title')}</h3>
        <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
          {t('subtitle', { total: data.totalCustomers, days })}
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.segments.map((seg) => (
            <div
              key={seg.segment}
              className="rounded-[var(--radius)] border p-4"
              style={{ borderColor: SEGMENT_COLORS[seg.segment] || '#e5e7eb' }}
            >
              <div className="mb-2 flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: SEGMENT_COLORS[seg.segment] || '#6b7280' }}
                />
                <span className="text-sm font-semibold">
                  {SEGMENT_LABELS[seg.segment] || seg.label}
                </span>
              </div>
              <p className="text-2xl font-bold">{seg.count}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t('pctCustomers', { pct: ((seg.count / data.totalCustomers) * 100).toFixed(1) })}
              </p>
              {/* Bar */}
              <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--color-bg-secondary)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(seg.count / maxCount) * 100}%`,
                    backgroundColor: SEGMENT_COLORS[seg.segment] || '#6b7280',
                  }}
                />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-[var(--color-text-secondary)]">
                <div>{t('rfmR', { value: seg.avgRecency })}</div>
                <div>{t('rfmF', { value: seg.avgFrequency.toFixed(1) })}</div>
                <div>{t('rfmM', { value: seg.avgMonetary.toFixed(0) })}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">{t('recommendationsTitle')}</h3>
        <div className="space-y-2 text-sm">
          <div className="rounded-[var(--radius)] bg-green-50 p-3">
            <p className="font-medium text-green-700">{t('recChampionsTitle')}</p>
            <p className="text-xs text-green-600">{t('recChampionsText')}</p>
          </div>
          <div className="rounded-[var(--radius)] bg-amber-50 p-3">
            <p className="font-medium text-amber-700">{t('recAttentionTitle')}</p>
            <p className="text-xs text-amber-600">{t('recAttentionText')}</p>
          </div>
          <div className="rounded-[var(--radius)] bg-red-50 p-3">
            <p className="font-medium text-red-700">{t('recRiskTitle')}</p>
            <p className="text-xs text-red-600">{t('recRiskText')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
