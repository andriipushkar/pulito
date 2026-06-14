'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';

interface Row {
  supplierId: number;
  supplierName: string;
  unitsSold: number;
  revenue: number;
  cost: number;
  margin: number;
  paid: number;
  balance: number;
  outstanding: number;
}
interface Report {
  from: string;
  to: string;
  rows: Row[];
  totals: {
    unitsSold: number;
    revenue: number;
    cost: number;
    margin: number;
    paid: number;
    balance: number;
    outstanding: number;
  };
}
interface Channel {
  id: number;
  name: string;
}

/** Today in Kyiv as YYYY-MM-DD — the backend treats from/to as Kyiv dates, so
 *  a UTC-derived default could be a day behind and silently drop today's sales. */
function kyivToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date());
}
function kyivDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(d);
}
/** First day of the current / previous Kyiv month (and its last day). */
function kyivMonthRange(offset: number): { from: string; to: string } {
  const todayParts = kyivToday().split('-').map(Number); // [y, m, d]
  const first = new Date(Date.UTC(todayParts[0], todayParts[1] - 1 + offset, 1));
  const last = new Date(Date.UTC(todayParts[0], todayParts[1] + offset, 0));
  const fmt = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(d);
  return { from: fmt(first), to: fmt(last) };
}

const money = (n: number) => n.toFixed(2);

export default function SupplierReconciliationPage() {
  const [from, setFrom] = useState(kyivDaysAgo(30));
  const [to, setTo] = useState(kyivToday());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [payout, setPayout] = useState({ supplierId: '', amount: '', note: '' });
  const [savingPayout, setSavingPayout] = useState(false);

  const loadChannels = useCallback(async () => {
    try {
      const res = await apiClient.get<Channel[]>('/api/v1/admin/supplier-channels');
      if (res.success && res.data) setChannels(res.data);
    } catch {
      /* non-critical */
    }
  }, []);

  const prefillPayout = (r: Row) => {
    setPayout({
      supplierId: String(r.supplierId),
      amount: r.outstanding > 0 ? r.outstanding.toFixed(2) : '',
      note: '',
    });
    toast.info(`Виплата для «${r.supplierName}» — сума підставлена`);
  };

  const savePayout = async () => {
    const supplierId = Number(payout.supplierId);
    const amount = Number(payout.amount);
    if (!supplierId || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Оберіть постачальника і вкажіть суму > 0');
      return;
    }
    setSavingPayout(true);
    try {
      const res = await apiClient.post('/api/v1/admin/supplier-channels/payouts', {
        supplierId,
        amount,
        note: payout.note.trim() || null,
      });
      if (res.success) {
        toast.success('Виплату записано');
        setPayout({ supplierId: '', amount: '', note: '' });
        load();
      } else {
        toast.error(res.error || 'Не вдалося зберегти');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setSavingPayout(false);
    }
  };

  const load = useCallback(async () => {
    if (from > to) {
      toast.error('Дата «Від» не може бути пізнішою за «До»');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get<Report>(
        `/api/v1/admin/supplier-channels/reconciliation?from=${from}&to=${to}`,
      );
      if (res.success && res.data) setReport(res.data);
      else toast.error(res.error || 'Не вдалося сформувати звіт');
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
    loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Звіт розрахунків з постачальниками</h1>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Скільки продано товару кожного постачальника і скільки ви йому винні (за закупівельною
            ціною на момент продажу). Скасовані замовлення не враховуються.
          </p>
        </div>
        <Link href="/admin/import" className="text-sm text-[var(--color-primary)] underline">
          ← До каналів
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
        <div className="flex flex-wrap gap-1">
          {[
            { label: 'Цей місяць', range: () => kyivMonthRange(0) },
            { label: 'Минулий місяць', range: () => kyivMonthRange(-1) },
            { label: '30 днів', range: () => ({ from: kyivDaysAgo(30), to: kyivToday() }) },
            { label: '90 днів', range: () => ({ from: kyivDaysAgo(90), to: kyivToday() }) },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                const r = p.range();
                setFrom(r.from);
                setTo(r.to);
              }}
              className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)]"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {report && (
        <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-2 py-2 text-left">Постачальник</th>
                <th className="px-2 py-2 text-right">Продано, шт.</th>
                <th className="px-2 py-2 text-right">Виручка, ₴</th>
                <th className="px-2 py-2 text-right">Винні, ₴</th>
                <th className="px-2 py-2 text-right">Маржа, ₴</th>
                <th className="px-2 py-2 text-right">Виплачено, ₴</th>
                <th className="px-2 py-2 text-right">Баланс, ₴</th>
                <th className="px-2 py-2 text-right">Борг (всього), ₴</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-2 py-4 text-center text-[var(--color-text-secondary)]"
                  >
                    Немає продажів за період
                  </td>
                </tr>
              )}
              {report.rows.map((r) => (
                <tr
                  key={r.supplierId}
                  className="border-b border-[var(--color-border)] last:border-0"
                >
                  <td className="px-2 py-2 font-medium">{r.supplierName}</td>
                  <td className="px-2 py-2 text-right">{r.unitsSold}</td>
                  <td className="px-2 py-2 text-right">{money(r.revenue)}</td>
                  <td className="px-2 py-2 text-right">{money(r.cost)}</td>
                  <td className="px-2 py-2 text-right">{money(r.margin)}</td>
                  <td className="px-2 py-2 text-right">{money(r.paid)}</td>
                  <td
                    className={`px-2 py-2 text-right font-medium ${r.balance > 0 ? 'text-red-600' : 'text-green-700'}`}
                  >
                    {money(r.balance)}
                  </td>
                  <td
                    className={`px-2 py-2 text-right font-medium ${r.outstanding > 0 ? 'text-red-600' : 'text-green-700'}`}
                  >
                    <button
                      type="button"
                      title="Записати виплату на цю суму"
                      onClick={() => prefillPayout(r)}
                      className="underline decoration-dotted underline-offset-2 hover:opacity-80"
                    >
                      {money(r.outstanding)}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {report.rows.length > 0 && (
              <tfoot className="border-t border-[var(--color-border)] font-semibold">
                <tr>
                  <td className="px-2 py-2">Разом</td>
                  <td className="px-2 py-2 text-right">{report.totals.unitsSold}</td>
                  <td className="px-2 py-2 text-right">{money(report.totals.revenue)}</td>
                  <td className="px-2 py-2 text-right">{money(report.totals.cost)}</td>
                  <td className="px-2 py-2 text-right">{money(report.totals.margin)}</td>
                  <td className="px-2 py-2 text-right">{money(report.totals.paid)}</td>
                  <td className="px-2 py-2 text-right">{money(report.totals.balance)}</td>
                  <td className="px-2 py-2 text-right">{money(report.totals.outstanding)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Записати виплату постачальнику */}
      <div className="mt-6 rounded-md border border-[var(--color-border)] p-4">
        <h2 className="mb-3 text-sm font-semibold">Записати виплату постачальнику</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Постачальник</span>
            <select
              value={payout.supplierId}
              onChange={(e) => setPayout({ ...payout, supplierId: e.target.value })}
              className="h-10 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
            >
              <option value="">— оберіть —</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Сума, ₴</span>
            <input
              type="number"
              value={payout.amount}
              onChange={(e) => setPayout({ ...payout, amount: e.target.value })}
              className="h-10 w-32 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
            />
          </label>
          <label className="text-sm flex-1 min-w-[160px]">
            <span className="mb-1 block font-medium">Примітка (необов’язково)</span>
            <input
              type="text"
              value={payout.note}
              onChange={(e) => setPayout({ ...payout, note: e.target.value })}
              className="h-10 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
            />
          </label>
          <Button size="sm" onClick={savePayout} disabled={savingPayout}>
            {savingPayout ? 'Збереження…' : 'Зберегти виплату'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
          «Баланс» — за вибраний період; «Борг (всього)» — повна заборгованість за весь час (усі
          продажі − усі виплати). Клікніть суму боргу, щоб підставити її сюди.
        </p>
      </div>
    </div>
  );
}
