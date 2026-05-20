'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';

interface ForecastEntry {
  productId: number;
  name: string;
  code: string;
  currentStock: number;
  totalSold90d: number;
  avgDailySales: number;
  daysUntilOOS: number | null;
  reorderQty: number;
  urgency: 'critical' | 'soon' | 'ok' | 'over-stock' | 'no-sales';
}

const URGENCY_META: Record<
  ForecastEntry['urgency'],
  { label: string; color: string; rowBg: string }
> = {
  critical: {
    label: 'Терміново',
    color: 'bg-red-100 text-red-700 border-red-200',
    rowBg: 'bg-red-50/40',
  },
  soon: {
    label: 'Скоро',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    rowBg: 'bg-amber-50/30',
  },
  ok: { label: 'У нормі', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', rowBg: '' },
  'over-stock': {
    label: 'Надлишок',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    rowBg: '',
  },
  'no-sales': {
    label: 'Без продажів',
    color: 'bg-gray-100 text-gray-600 border-gray-200',
    rowBg: '',
  },
};

export default function ForecastingPage() {
  const [data, setData] = useState<ForecastEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadTime, setLeadTime] = useState(14);
  const [buffer, setBuffer] = useState(14);
  const [movingOnly, setMovingOnly] = useState(true);
  const [filter, setFilter] = useState<ForecastEntry['urgency'] | 'all'>('all');

  const load = async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('leadTimeDays', String(leadTime));
    qs.set('bufferDays', String(buffer));
    if (movingOnly) qs.set('movingOnly', '1');
    try {
      const res = await apiClient.get<ForecastEntry[]>(
        `/api/v1/admin/forecasting?${qs.toString()}`,
      );
      if (res.success && res.data) setData(res.data);
      else toast.error(res.error || 'Не вдалося завантажити прогноз');
    } catch {
      toast.error('Не вдалося завантажити прогноз');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadTime, buffer, movingOnly]);

  const filtered = useMemo(() => {
    return filter === 'all' ? data : data.filter((e) => e.urgency === filter);
  }, [data, filter]);

  const counts = useMemo(() => {
    const acc = { critical: 0, soon: 0, ok: 0, 'over-stock': 0, 'no-sales': 0 };
    for (const e of data) acc[e.urgency]++;
    return acc;
  }, [data]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Прогноз попиту</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          На основі продажів за останні 90 днів. Замовте товари до того, як вони закінчаться.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <NumberField
          label="Час доставки (днів)"
          value={leadTime}
          onChange={setLeadTime}
        />
        <NumberField label="Запас (днів)" value={buffer} onChange={setBuffer} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={movingOnly}
            onChange={(e) => setMovingOnly(e.target.checked)}
          />
          Тільки з продажами за 90 днів
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <FilterPill
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label={`Усі (${data.length})`}
        />
        {(['critical', 'soon', 'ok', 'over-stock', 'no-sales'] as const).map((key) => {
          const meta = URGENCY_META[key];
          return (
            <FilterPill
              key={key}
              active={filter === key}
              onClick={() => setFilter(key)}
              label={`${meta.label} (${counts[key]})`}
              className={meta.color}
            />
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <th className="px-3 py-3 text-left font-medium">Артикул</th>
                <th className="px-3 py-3 text-left font-medium">Товар</th>
                <th className="px-3 py-3 text-right font-medium">Залишок</th>
                <th className="px-3 py-3 text-right font-medium">Продано 90д</th>
                <th className="px-3 py-3 text-right font-medium">сер./день</th>
                <th className="px-3 py-3 text-right font-medium">Днів до OOS</th>
                <th className="px-3 py-3 text-center font-medium">Статус</th>
                <th className="px-3 py-3 text-right font-medium">Замовити</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const meta = URGENCY_META[e.urgency];
                return (
                  <tr
                    key={e.productId}
                    className={`border-b border-[var(--color-border)] last:border-0 ${meta.rowBg}`}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{e.code}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/products/${e.productId}`}
                        className="text-[var(--color-primary)] hover:underline"
                      >
                        {e.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.currentStock}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.totalSold90d}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {e.avgDailySales.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {e.daysUntilOOS !== null ? e.daysUntilOOS.toFixed(0) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">
                      {e.reorderQty > 0 ? e.reorderQty : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
              Немає даних з обраним фільтром
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col text-xs">
      <span className="mb-1 text-[var(--color-text-secondary)]">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-24 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm tabular-nums"
      />
    </label>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  className,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 font-medium transition-colors ${
        active
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
          : className ?? 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)]'
      }`}
    >
      {label}
    </button>
  );
}
