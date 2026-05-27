'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface FinanceChartProps {
  data: { month: string; [key: string]: string | number }[];
  dataKey: string;
  color: string;
}

export default function FinanceChart({ data, dataKey, color }: FinanceChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-[var(--color-text-secondary)]">
        Немає даних для відображення
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
          tickFormatter={(v: string) => {
            const [, m] = v.split('-');
            const months = [
              'Січ',
              'Лют',
              'Бер',
              'Кві',
              'Тра',
              'Чер',
              'Лип',
              'Сер',
              'Вер',
              'Жов',
              'Лис',
              'Гру',
            ];
            return months[Number(m) - 1] || m;
          }}
        />
        <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} width={60} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            fontSize: 12,
          }}
        />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
