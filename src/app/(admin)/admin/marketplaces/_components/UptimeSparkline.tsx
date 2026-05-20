'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

export function UptimeSparkline({ platform }: { platform: string }) {
  const [data, setData] = useState<{
    history: { checkedAt: string; status: string; latencyMs: number }[];
    uptime: number;
    count: number;
  } | null>(null);

  useEffect(() => {
    apiClient
      .get<typeof data>(`/api/v1/admin/marketplaces/${platform}/health-history`)
      .then((res) => {
        if (res.success && res.data) setData(res.data);
      });
  }, [platform]);

  if (!data || data.count === 0) return null;

  const last30 = data.history.slice(-30);

  return (
    <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-xs">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[var(--color-text-secondary)]">
          Доступність ({data.count} перевірок):
        </span>
        <span
          className={`font-semibold ${
            data.uptime >= 99
              ? 'text-green-700'
              : data.uptime >= 90
              ? 'text-amber-700'
              : 'text-red-700'
          }`}
        >
          {data.uptime}%
        </span>
      </div>
      <div className="flex h-4 items-end gap-[1px]">
        {last30.map((h, i) => (
          <div
            key={i}
            title={`${new Date(h.checkedAt).toLocaleString('uk-UA')} — ${h.status} (${h.latencyMs}мс)`}
            className={`flex-1 ${
              h.status === 'ok'
                ? 'bg-green-400'
                : h.status === 'error'
                ? 'bg-red-400'
                : h.status === 'disabled'
                ? 'bg-gray-300'
                : 'bg-amber-400'
            }`}
            style={{ height: `${Math.max(20, Math.min(100, h.latencyMs / 10))}%` }}
          />
        ))}
      </div>
    </div>
  );
}
