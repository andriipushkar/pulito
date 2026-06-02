'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface Bucket {
  gross: number;
  refunds: number;
  net: number;
  orders: number;
}
interface Report {
  periodLabel: string;
  group: number;
  direct: Bucket;
  marketplace: Bucket;
  codNet: number;
  periodIncome: number;
  ytdIncome: number;
  estimatedTax: number;
  ratePercent: number | null;
  incomeLimit: number | null;
  limitUsedPercent: number | null;
  warnings: string[];
  tin: string;
  name: string;
}

const CURRENT_YEAR = new Date().getFullYear();

export default function TaxReportPage() {
  const t = useTranslations('admin.taxReport');

  // ── ФОП settings (point 1) ──
  const [tin, setTin] = useState('');
  const [name, setName] = useState('');
  const [group, setGroup] = useState(3);
  const [rate, setRate] = useState(5);
  const [fixedTax, setFixedTax] = useState(0);
  const [incomeLimit, setIncomeLimit] = useState(0);
  const [savingSettings, setSavingSettings] = useState(false);

  // ── report params ──
  const [year, setYear] = useState(CURRENT_YEAR);
  const [quarter, setQuarter] = useState<number>(1); // 0 = full year
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiClient
      .post<{
        tin: string;
        name: string;
        defaultGroup: number;
        ratePercent: number;
        incomeLimit: number;
      }>('/api/v1/admin/tax-report', {})
      .then((res) => {
        if (res.success && res.data) {
          setTin(res.data.tin);
          setName(res.data.name);
          setGroup(res.data.defaultGroup || 3);
          setRate(res.data.ratePercent || 5);
          setIncomeLimit(res.data.incomeLimit || 0);
        }
      })
      .catch(() => {});
  }, []);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await apiClient.put('/api/v1/admin/tax-report', {
        tin,
        name,
        defaultGroup: group,
        ratePercent: rate,
        incomeLimit,
      });
      if (res.success) toast.success(t('settingsSaved'));
      else toast.error(res.error || t('error'));
    } catch {
      toast.error(t('error'));
    } finally {
      setSavingSettings(false);
    }
  };

  const buildQuery = () => {
    const p = new URLSearchParams({ year: String(year), group: String(group) });
    if (quarter >= 1) p.set('quarter', String(quarter));
    if (group === 3) p.set('rate', String(rate));
    else p.set('fixedTax', String(fixedTax));
    return p.toString();
  };

  const generate = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<Report>(`/api/v1/admin/tax-report?${buildQuery()}`);
      if (res.success && res.data) setReport(res.data);
      else toast.error(res.error || t('error'));
    } catch {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = () => {
    window.open(`/api/v1/admin/tax-report?${buildQuery()}&format=csv`, '_blank');
  };

  const money = (n: number) => `${n.toFixed(2)} ₴`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('subtitle')}</p>
      </div>

      {/* Disclaimer */}
      <div className="rounded-[var(--radius)] border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        {t('disclaimer')}
      </div>

      {/* ── ФОП settings ── */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h2 className="mb-3 text-sm font-semibold">{t('settingsTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('tinLabel')} value={tin} onChange={(e) => setTin(e.target.value)} />
          <Input label={t('nameLabel')} value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <label className="mb-1 block text-sm font-medium">{t('groupLabel')}</label>
            <select
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2"
              value={group}
              onChange={(e) => setGroup(Number(e.target.value))}
            >
              <option value={1}>{t('group1')}</option>
              <option value={2}>{t('group2')}</option>
              <option value={3}>{t('group3')}</option>
            </select>
          </div>
          {group === 3 ? (
            <Input
              label={t('rateLabel')}
              type="number"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          ) : (
            <Input
              label={t('fixedTaxLabel')}
              type="number"
              value={fixedTax}
              onChange={(e) => setFixedTax(Number(e.target.value))}
            />
          )}
          <Input
            label={t('incomeLimitLabel')}
            type="number"
            value={incomeLimit}
            onChange={(e) => setIncomeLimit(Number(e.target.value))}
          />
        </div>
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={saveSettings} isLoading={savingSettings}>
            {t('saveSettings')}
          </Button>
        </div>
      </div>

      {/* ── Report params ── */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h2 className="mb-3 text-sm font-semibold">{t('reportTitle')}</h2>
        <div className="flex flex-wrap items-end gap-4">
          <Input
            label={t('yearLabel')}
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-28"
          />
          <div>
            <label className="mb-1 block text-sm font-medium">{t('quarterLabel')}</label>
            <select
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2"
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value))}
            >
              <option value={1}>Q1</option>
              <option value={2}>Q2</option>
              <option value={3}>Q3</option>
              <option value={4}>Q4</option>
              <option value={0}>{t('quarterAll')}</option>
            </select>
          </div>
          <Button onClick={generate} isLoading={loading}>
            {t('generate')}
          </Button>
          {report && (
            <Button variant="secondary" onClick={downloadCsv}>
              {t('downloadCsv')}
            </Button>
          )}
        </div>
      </div>

      {/* ── Preview ── */}
      {report && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h2 className="mb-3 text-sm font-semibold">
            {report.periodLabel} · {t('groupShort')} {report.group}
          </h2>
          <table className="w-full text-sm">
            <tbody>
              <Row label={t('rowDirectGross')} value={money(report.direct.gross)} />
              <Row label={t('rowDirectNet')} value={money(report.direct.net)} strong />
              <Row label={t('rowMpGross')} value={money(report.marketplace.gross)} />
              <Row label={t('rowMpNet')} value={money(report.marketplace.net)} strong />
              <Row label={t('rowCod')} value={money(report.codNet)} />
              <Row label={t('rowPeriodIncome')} value={money(report.periodIncome)} strong />
              <Row label={t('rowYtdIncome')} value={money(report.ytdIncome)} strong />
              <Row label={t('rowTax')} value={money(report.estimatedTax)} strong />
              {report.limitUsedPercent != null && (
                <Row
                  label={t('rowLimitUsed')}
                  value={`${report.limitUsedPercent.toFixed(1)}% / ${money(report.incomeLimit ?? 0)}`}
                />
              )}
            </tbody>
          </table>

          {report.warnings.length > 0 && (
            <div className="mt-4 space-y-1 text-xs text-amber-700">
              <div className="font-semibold">{t('warningsTitle')}</div>
              {report.warnings.map((w, i) => (
                <div key={i}>⚠️ {w}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr className="border-b border-[var(--color-border)]">
      <td className="py-2">{label}</td>
      <td className={`py-2 text-right ${strong ? 'font-semibold' : ''}`}>{value}</td>
    </tr>
  );
}
