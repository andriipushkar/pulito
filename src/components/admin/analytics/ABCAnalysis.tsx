'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface ABCProduct {
  productId: number | null;
  productCode: string;
  productName: string;
  revenue: number;
  quantity: number;
  orders: number;
  revenuePercent: number;
  cumulativePercent: number;
  category: 'A' | 'B' | 'C';
}

interface ABCSummary {
  A: number;
  B: number;
  C: number;
  totalRevenue: number;
  totalProducts: number;
}

interface ABCData {
  products: ABCProduct[];
  summary: ABCSummary;
}

const CATEGORY_COLORS = {
  A: '#10b981',
  B: '#f59e0b',
  C: '#ef4444',
};

export default function ABCAnalysis({ days = 30 }: { days?: number }) {
  const [data, setData] = useState<ABCData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<ABCData>(`/api/v1/admin/analytics/abc?days=${days}`)
      .then((res) => {
        if (res.success && res.data) setData(res.data);
      })
      .finally(() => setIsLoading(false));
  }, [days]);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  if (!data) return null;

  const pieData = [
    { name: `A (${data.summary.A} товарів)`, value: data.summary.A, fill: CATEGORY_COLORS.A },
    { name: `B (${data.summary.B} товарів)`, value: data.summary.B, fill: CATEGORY_COLORS.B },
    { name: `C (${data.summary.C} товарів)`, value: data.summary.C, fill: CATEGORY_COLORS.C },
  ];

  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Загальна виручка</p>
          <p className="text-xl font-bold">{data.summary.totalRevenue.toFixed(0)} ₴</p>
        </div>
        {(['A', 'B', 'C'] as const).map((cat) => (
          <div
            key={cat}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
          >
            <p className="text-xs text-[var(--color-text-secondary)]">
              Група {cat} ({cat === 'A' ? '80%' : cat === 'B' ? '15%' : '5%'} виручки)
            </p>
            <p className="text-xl font-bold" style={{ color: CATEGORY_COLORS[cat] }}>
              {data.summary[cat]} товарів
            </p>
          </div>
        ))}
      </div>

      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={90} label>
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              <th className="px-3 py-2 text-left">Кат.</th>
              <th className="px-3 py-2 text-left">Код</th>
              <th className="px-3 py-2 text-left">Назва</th>
              <th className="px-3 py-2 text-right">Виручка</th>
              <th className="px-3 py-2 text-right">% виручки</th>
              <th className="px-3 py-2 text-right">К-ть</th>
              <th className="px-3 py-2 text-right">Замовлень</th>
            </tr>
          </thead>
          <tbody>
            {data.products.slice(0, 50).map((p, i) => (
              <tr key={i} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-1.5">
                  <span
                    className="inline-block rounded px-1.5 py-0.5 text-xs font-bold text-white"
                    style={{ backgroundColor: CATEGORY_COLORS[p.category] }}
                  >
                    {p.category}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-xs">{p.productCode}</td>
                <td className="px-3 py-1.5 text-xs">{p.productName}</td>
                <td className="px-3 py-1.5 text-right text-xs">{p.revenue.toFixed(0)} ₴</td>
                <td className="px-3 py-1.5 text-right text-xs">{p.revenuePercent.toFixed(1)}%</td>
                <td className="px-3 py-1.5 text-right text-xs">{p.quantity}</td>
                <td className="px-3 py-1.5 text-right text-xs">{p.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
