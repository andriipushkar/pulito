'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface PriceHistoryEntry {
  id: number;
  priceRetailNew: string | null;
  priceWholesaleNew: string | null;
  changedAt: string;
}

interface PriceHistoryChartProps {
  productSlug: string;
}

export default function PriceHistoryChart({ productSlug }: PriceHistoryChartProps) {
  const [data, setData] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/products/${productSlug}/price-history`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data.length > 0) {
          setData(json.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productSlug]);

  if (loading || data.length === 0) return null;

  const chartData = data.map((entry) => ({
    date: new Date(entry.changedAt).toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
    }),
    retail: entry.priceRetailNew ? Number(entry.priceRetailNew) : null,
    wholesale: entry.priceWholesaleNew ? Number(entry.priceWholesaleNew) : null,
  }));

  return (
    <div
      className="mt-8 rounded-lg border p-4"
      style={{ borderColor: 'var(--color-border, #e2e8f0)' }}
    >
      <h3 className="mb-4 text-lg font-semibold" style={{ color: 'var(--color-text, #1e293b)' }}>
        Історія цін
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" fontSize={12} stroke="#94a3b8" />
          <YAxis fontSize={12} stroke="#94a3b8" tickFormatter={(v) => `${v} ₴`} />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(2)} ₴`]}
            labelFormatter={(label) => `Дата: ${label}`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="retail"
            name="Роздрібна"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="wholesale"
            name="Гуртова"
            stroke="#16a34a"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
