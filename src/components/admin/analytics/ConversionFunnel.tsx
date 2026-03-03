'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface FunnelStep {
  name: string;
  value: number;
  conversionFromPrev: number;
  conversionFromFirst: number;
}

interface FunnelData {
  steps: FunnelStep[];
  totals: Record<string, number>;
}

const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#10b981'];

export default function ConversionFunnel({ days = 30 }: { days?: number }) {
  const [data, setData] = useState<FunnelData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<FunnelData>(`/api/v1/admin/analytics/funnel?days=${days}`)
      .then((res) => {
        if (res.success && res.data) setData(res.data);
      })
      .finally(() => setIsLoading(false));
  }, [days]);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  if (!data) return null;

  return (
    <div>
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-4 text-sm font-semibold">Воронка конверсії</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.steps} layout="vertical">
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, _name: any, props: any) => [
                `${Number(value).toLocaleString()} (${(props.payload as FunnelStep).conversionFromFirst.toFixed(1)}% від першого кроку)`,
                'Кількість',
              ]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.steps.map((_entry, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              <th className="px-4 py-2 text-left">Крок</th>
              <th className="px-4 py-2 text-right">Кількість</th>
              <th className="px-4 py-2 text-right">% від попереднього</th>
              <th className="px-4 py-2 text-right">% від першого</th>
            </tr>
          </thead>
          <tbody>
            {data.steps.map((step, i) => (
              <tr key={i} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2 text-xs">{step.name}</td>
                <td className="px-4 py-2 text-right text-xs">{step.value.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-xs">{step.conversionFromPrev.toFixed(1)}%</td>
                <td className="px-4 py-2 text-right text-xs">{step.conversionFromFirst.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
