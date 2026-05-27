'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { formatPrice } from '@/utils/format';
import Spinner from '@/components/ui/Spinner';

interface ParityRow {
  id: number;
  platform: string;
  productId: number;
  productCode: string;
  productName: string;
  sitePrice: number;
  externalId: string | null;
  externalUrl: string | null;
  status: string;
  lastError: string | null;
  syncedAt: string | null;
  issue: 'error' | 'stale';
}

interface ParityReport {
  total: number;
  withErrors: number;
  stale: number;
  rows: ParityRow[];
}

const PLATFORM_LABEL: Record<string, string> = {
  olx: 'OLX',
  rozetka: 'Rozetka',
  prom: 'Prom.ua',
  epicentrk: 'Epicentr',
};

export default function PricingParityPage() {
  const [report, setReport] = useState<ParityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'error' | 'stale'>('all');

  useEffect(() => {
    apiClient
      .get<ParityReport>('/api/v1/admin/marketplaces/pricing-parity')
      .then((res) => {
        if (res.success && res.data) setReport(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (!report)
    return <p className="text-sm text-[var(--color-danger)]">Не вдалося завантажити звіт</p>;

  const filtered = report.rows.filter((r) => filter === 'all' || r.issue === filter);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link
            href="/admin/marketplaces"
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            ← Маркетплейси
          </Link>
          <h2 className="mt-1 text-xl font-bold">Pricing Parity</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Listings де ціна на маркетплейсі може відрізнятись від сайту (sync помилки або
            застарілі).
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-xl bg-slate-50 px-4 py-3 text-left transition-all hover:scale-[1.02] hover:shadow-md ${filter === 'all' ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
        >
          <p className="text-2xl font-bold text-slate-700">{report.total}</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">Усі проблеми</p>
        </button>
        <button
          onClick={() => setFilter('error')}
          className={`rounded-xl bg-red-50 px-4 py-3 text-left transition-all hover:scale-[1.02] hover:shadow-md ${filter === 'error' ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
        >
          <p className="text-2xl font-bold text-red-700">{report.withErrors}</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">Sync помилки</p>
        </button>
        <button
          onClick={() => setFilter('stale')}
          className={`rounded-xl bg-amber-50 px-4 py-3 text-left transition-all hover:scale-[1.02] hover:shadow-md ${filter === 'stale' ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
        >
          <p className="text-2xl font-bold text-amber-700">{report.stale}</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">Застарілі &gt;7 днів</p>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-text-secondary)]">
          🎉 Усі listings синхронізовано вчасно. Pricing parity OK.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-secondary)] text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Платформа</th>
                <th className="px-3 py-2 text-left">Товар</th>
                <th className="px-3 py-2 text-right">Ціна сайту</th>
                <th className="px-3 py-2 text-left">Sync</th>
                <th className="px-3 py-2 text-left">Проблема</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t border-[var(--color-border)] ${row.issue === 'error' ? 'bg-red-50/50' : 'bg-amber-50/30'}`}
                >
                  <td className="px-3 py-2 font-medium">
                    {PLATFORM_LABEL[row.platform] || row.platform}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/products/${row.productId}`}
                      className="text-[var(--color-primary)] hover:underline"
                    >
                      {row.productCode} — {row.productName.slice(0, 40)}
                      {row.productName.length > 40 ? '…' : ''}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatPrice(row.sitePrice)}
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                    {row.syncedAt ? new Date(row.syncedAt).toLocaleString('uk-UA') : '— ніколи —'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.lastError ? (
                      <span className="text-red-700" title={row.lastError}>
                        🔴 {row.lastError.slice(0, 40)}
                        {row.lastError.length > 40 ? '…' : ''}
                      </span>
                    ) : (
                      <span className="text-amber-700">🟡 Не синхронізовано &gt;7 днів</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.externalUrl && (
                      <a
                        href={row.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--color-primary)] hover:underline"
                      >
                        Відкрити ↗
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
