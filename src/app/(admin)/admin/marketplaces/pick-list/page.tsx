'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

interface PickListRow {
  productCode: string;
  productName: string;
  totalQuantity: number;
  orders: { orderNumber: string; platform: string; quantity: number; status: string }[];
}

interface PickListData {
  rows: PickListRow[];
  totalItems: number;
  totalProducts: number;
}

const PLATFORM_ICON: Record<string, string> = {
  olx: '🟢',
  rozetka: '🟩',
  prom: '🔵',
  epicentrk: '🟠',
};

export default function PickListPage() {
  const t = useTranslations('admin.pickListPage');
  const [data, setData] = useState<PickListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .get<PickListData>('/api/v1/admin/marketplaces/pick-list')
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setData(res.data);
        else toast.error(res.error || t('loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken, t]);

  const toggle = (code: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handlePrint = () => window.print();

  const handleExportCsv = () => {
    if (!data) return;
    const rows = [
      ['productCode', 'productName', 'totalQuantity', 'orders'],
      ...data.rows.map((r) => [
        r.productCode,
        r.productName.replace(/[\r\n]+/g, ' '),
        String(r.totalQuantity),
        r.orders.map((o) => `${o.orderNumber}(${o.platform}×${o.quantity})`).join(' '),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((c) => {
            const s = String(c);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(','),
      )
      .join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pick-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (!data) return null;

  const pickedCount = checked.size;
  const pickedQuantity = data.rows
    .filter((r) => checked.has(r.productCode))
    .reduce((s, r) => s + r.totalQuantity, 0);

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/marketplaces"
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            {t('backToMarketplaces')}
          </Link>
          <h2 className="mt-1 text-xl font-bold">{t('title')}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('intro')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={refresh}>
            {t('refresh')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            disabled={data.rows.length === 0}
          >
            {t('csv')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrint}
            disabled={data.rows.length === 0}
          >
            {t('print')}
          </Button>
        </div>
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
          <div>
            <span className="text-[var(--color-text-secondary)]">{t('skuLabel')}</span>
            <strong>{data.totalProducts}</strong>
          </div>
          <div>
            <span className="text-[var(--color-text-secondary)]">{t('totalUnitsLabel')}</span>
            <strong>{data.totalItems}</strong>
          </div>
          <div className="ml-auto text-[var(--color-text-secondary)]">
            {t('pickedLabel')} <strong>{pickedCount}</strong> {t('skuPart')}{' '}
            <strong>{pickedQuantity}</strong> {t('unitsPart')}
          </div>
        </div>

        {data.rows.length === 0 ? (
          <p className="py-12 text-center text-[var(--color-text-secondary)]">{t('empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-secondary)]">
                <th className="w-8 px-2 py-2"></th>
                <th className="px-2 py-2">{t('colArticle')}</th>
                <th className="px-2 py-2">{t('colProduct')}</th>
                <th className="px-2 py-2 text-right">{t('colQty')}</th>
                <th className="px-2 py-2">{t('colOrders')}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const isChecked = checked.has(row.productCode);
                return (
                  <tr
                    key={row.productCode}
                    className={`border-b border-[var(--color-border)] transition-colors ${
                      isChecked ? 'bg-green-50 text-[var(--color-text-secondary)] line-through' : ''
                    }`}
                  >
                    <td className="px-2 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(row.productCode)}
                        className="h-4 w-4 accent-green-500"
                      />
                    </td>
                    <td className="px-2 py-2 align-top font-mono text-xs">{row.productCode}</td>
                    <td className="px-2 py-2 align-top">{row.productName}</td>
                    <td className="px-2 py-2 text-right align-top font-bold">
                      {row.totalQuantity}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        {row.orders.map((o, i) => (
                          <span
                            key={`${o.orderNumber}-${i}`}
                            className="rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5"
                            title={`${o.platform} · ${o.status}`}
                          >
                            {PLATFORM_ICON[o.platform] || ''} {o.orderNumber} ×{o.quantity}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
