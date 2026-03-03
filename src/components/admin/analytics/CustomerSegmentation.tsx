'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';

interface SegmentCustomer {
  userId: number;
  email: string;
  fullName: string | null;
  lastOrderDays: number;
  orderCount: number;
  totalSpent: number;
}

interface Segment {
  segment: string;
  label: string;
  count: number;
  revenue: number;
  avgCheck: number;
  customers: SegmentCustomer[];
}

interface SegmentData {
  segments: Segment[];
  totalCustomers: number;
  totalRevenue: number;
}

const SEGMENT_COLORS: Record<string, string> = {
  champions: '#22c55e',
  loyal: '#3b82f6',
  recent: '#06b6d4',
  promising: '#8b5cf6',
  at_risk: '#f59e0b',
  sleeping: '#f97316',
  lost: '#ef4444',
  new: '#64748b',
};

export default function CustomerSegmentation() {
  const [data, setData] = useState<SegmentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<SegmentData>('/api/v1/admin/analytics/segments')
      .then((res) => { if (res.success && res.data) setData(res.data); })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  if (!data) return null;

  return (
    <div>
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Всього клієнтів</p>
          <p className="text-2xl font-bold">{data.totalCustomers}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Загальна виручка</p>
          <p className="text-2xl font-bold">{data.totalRevenue.toFixed(0)} ₴</p>
        </div>
      </div>

      {/* Segment bars */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-4 text-sm font-semibold">Розподіл клієнтів по сегментах</h3>
        {data.totalCustomers > 0 && (
          <div className="mb-3 flex h-8 overflow-hidden rounded-[var(--radius)]">
            {data.segments.filter((s) => s.count > 0).map((seg) => (
              <div
                key={seg.segment}
                className="flex items-center justify-center text-[10px] font-medium text-white transition-all"
                style={{
                  width: `${(seg.count / data.totalCustomers) * 100}%`,
                  backgroundColor: SEGMENT_COLORS[seg.segment] || '#94a3b8',
                  minWidth: seg.count > 0 ? 24 : 0,
                }}
                title={`${seg.label}: ${seg.count}`}
              >
                {(seg.count / data.totalCustomers) * 100 >= 5 ? seg.count : ''}
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {data.segments.map((seg) => (
            <div key={seg.segment} className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: SEGMENT_COLORS[seg.segment] || '#94a3b8' }} />
              <span className="text-xs">{seg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Segment cards */}
      <div className="space-y-3">
        {data.segments.map((seg) => (
          <div
            key={seg.segment}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden"
          >
            <button
              onClick={() => setExpanded(expanded === seg.segment ? null : seg.segment)}
              className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-[var(--color-bg-secondary)]"
            >
              <div
                className="h-4 w-4 rounded-sm flex-shrink-0"
                style={{ backgroundColor: SEGMENT_COLORS[seg.segment] || '#94a3b8' }}
              />
              <div className="flex-1">
                <span className="text-sm font-medium">{seg.label}</span>
                <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                  ({data.totalCustomers > 0 ? ((seg.count / data.totalCustomers) * 100).toFixed(1) : 0}%)
                </span>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-sm font-bold">{seg.count}</p>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">клієнтів</p>
                </div>
                <div>
                  <p className="text-sm font-bold">{seg.revenue.toFixed(0)} ₴</p>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">виручка</p>
                </div>
                <div>
                  <p className="text-sm font-bold">{seg.avgCheck} ₴</p>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">сер. чек</p>
                </div>
              </div>
              <span className="text-xs text-[var(--color-text-secondary)]">{expanded === seg.segment ? '▲' : '▼'}</span>
            </button>

            {expanded === seg.segment && seg.customers.length > 0 && (
              <div className="border-t border-[var(--color-border)] px-4 py-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[var(--color-text-secondary)]">
                      <th className="py-1 text-left font-medium">Email</th>
                      <th className="py-1 text-left font-medium">Ім&apos;я</th>
                      <th className="py-1 text-right font-medium">Замовлень</th>
                      <th className="py-1 text-right font-medium">Витрачено</th>
                      <th className="py-1 text-right font-medium">Днів тому</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seg.customers.map((c) => (
                      <tr key={c.userId} className="border-t border-[var(--color-border)]/50">
                        <td className="py-1.5">{c.email}</td>
                        <td className="py-1.5">{c.fullName || '—'}</td>
                        <td className="py-1.5 text-right">{c.orderCount}</td>
                        <td className="py-1.5 text-right font-medium">{c.totalSpent} ₴</td>
                        <td className="py-1.5 text-right text-[var(--color-text-secondary)]">{c.lastOrderDays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
