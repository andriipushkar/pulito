'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';

interface CohortRow {
  cohort: string;
  totalUsers: number;
  retention: Record<string, number>;
}

function getHeatColor(value: number): string {
  if (value === 0) return 'transparent';
  if (value < 10) return '#fef3c7';
  if (value < 25) return '#fde68a';
  if (value < 50) return '#fbbf24';
  if (value < 75) return '#f59e0b';
  return '#d97706';
}

export default function CohortAnalysis({ months = 6 }: { months?: number }) {
  const [data, setData] = useState<CohortRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<CohortRow[]>(`/api/v1/admin/analytics/cohorts?months=${months}`)
      .then((res) => {
        if (res.success && res.data) setData(res.data);
      })
      .finally(() => setIsLoading(false));
  }, [months]);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="md" /></div>;

  if (data.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-center text-sm text-[var(--color-text-secondary)]">
        Недостатньо даних для когортного аналізу
      </div>
    );
  }

  // Collect all unique months
  const allMonths = new Set<string>();
  for (const row of data) {
    for (const month of Object.keys(row.retention)) {
      allMonths.add(month);
    }
  }
  const sortedMonths = [...allMonths].sort();

  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold">Когортний аналіз (retention %)</h3>
      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
        <table className="w-full text-xs">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              <th className="px-3 py-2 text-left">Когорта</th>
              <th className="px-3 py-2 text-right">Юзери</th>
              {sortedMonths.map((m) => (
                <th key={m} className="px-3 py-2 text-center">{m.slice(5)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.cohort} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 font-medium">{row.cohort}</td>
                <td className="px-3 py-2 text-right">{row.totalUsers}</td>
                {sortedMonths.map((m) => {
                  const value = row.retention[m] || 0;
                  return (
                    <td
                      key={m}
                      className="px-3 py-2 text-center"
                      style={{ backgroundColor: getHeatColor(value) }}
                    >
                      {value > 0 ? `${value.toFixed(0)}%` : '–'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
