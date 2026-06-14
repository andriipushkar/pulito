'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';

interface Row {
  key: string;
  label: string;
  revenue: number;
  cogs: number;
  profit: number;
  margin: number;
  units: number;
  unknownCostUnits: number;
}
interface Report {
  from: string;
  to: string;
  totals: {
    revenue: number;
    cogs: number;
    profit: number;
    margin: number;
    units: number;
    orders: number;
    unknownCostUnits: number;
  };
  topProducts: Row[];
  lossProducts: Row[];
  byCategory: Row[];
  bySupplier: Row[];
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
const money = (n: number) => n.toFixed(2);

function Table({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="mt-6">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
            <tr>
              <th className="px-2 py-2 text-left">Назва</th>
              <th className="px-2 py-2 text-right">Шт.</th>
              <th className="px-2 py-2 text-right">Виручка, ₴</th>
              <th className="px-2 py-2 text-right">Собіварт., ₴</th>
              <th className="px-2 py-2 text-right">Прибуток, ₴</th>
              <th className="px-2 py-2 text-right">Маржа, %</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-2 py-4 text-center text-[var(--color-text-secondary)]"
                >
                  Немає даних
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-[var(--color-border)] last:border-0">
                <td className="px-2 py-2">
                  {r.label}
                  {r.unknownCostUnits > 0 && (
                    <span
                      className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700"
                      title="У частини позицій невідома собівартість — маржа занижена"
                    >
                      ціна закупки невідома
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-right">{r.units}</td>
                <td className="px-2 py-2 text-right">{money(r.revenue)}</td>
                <td className="px-2 py-2 text-right">{money(r.cogs)}</td>
                <td
                  className={`px-2 py-2 text-right font-medium ${r.profit < 0 ? 'text-red-600' : 'text-green-700'}`}
                >
                  {money(r.profit)}
                </td>
                <td className="px-2 py-2 text-right">{r.margin.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] p-3">
      <div className="text-xs text-[var(--color-text-secondary)]">{label}</div>
      <div className={`text-lg font-semibold ${accent ?? ''}`}>{value}</div>
    </div>
  );
}

export default function ProfitAnalyticsPage() {
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<Report>(
        `/api/v1/admin/analytics/profit?from=${from}&to=${to}`,
      );
      if (res.success && res.data) setReport(res.data);
      else toast.error(res.error || 'Не вдалося завантажити');
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Прибуток</h1>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Виручка мінус собівартість (закупка × кількість) за період. Скасовані замовлення не
            враховуються. Знижки рівня замовлення (промокод/бали) не вираховуються — це маржа по
            товарах, не повний P&amp;L.
          </p>
        </div>
        <Link href="/admin/analytics" className="text-sm text-[var(--color-primary)] underline">
          ← Аналітика
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Від</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">До</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
          />
        </label>
        <Button size="sm" onClick={load} disabled={loading}>
          {loading ? 'Завантаження…' : 'Сформувати'}
        </Button>
      </div>

      {report && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Виручка, ₴" value={money(report.totals.revenue)} />
            <Kpi label="Собівартість, ₴" value={money(report.totals.cogs)} />
            <Kpi
              label="Прибуток, ₴"
              value={money(report.totals.profit)}
              accent={report.totals.profit < 0 ? 'text-red-600' : 'text-green-700'}
            />
            <Kpi label="Маржа, %" value={report.totals.margin.toFixed(1)} />
            <Kpi label="Замовлень" value={String(report.totals.orders)} />
            <Kpi label="Одиниць" value={String(report.totals.units)} />
          </div>

          {report.totals.unknownCostUnits > 0 && (
            <p className="mt-2 text-xs text-amber-700">
              ⚠️ У {report.totals.unknownCostUnits} проданих одиниць немає закупівельної ціни —
              реальний прибуток нижчий. Заповни «Собівартість» у картках товарів для точності.
            </p>
          )}

          <Table title="Топ за прибутком" rows={report.topProducts} />
          {report.lossProducts.length > 0 && (
            <Table title="🔻 Збиткові (продаються нижче собівартості)" rows={report.lossProducts} />
          )}
          <Table title="По категоріях" rows={report.byCategory} />
          <Table title="По постачальниках" rows={report.bySupplier} />
        </>
      )}
    </div>
  );
}
