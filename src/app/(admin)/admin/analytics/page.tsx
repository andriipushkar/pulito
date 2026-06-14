'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { formatPrice } from '@/utils/format';
import { WHOLESALE_GROUP_LABELS } from '@/types/user';
import type { WholesaleGroup } from '@/types/user';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';

// Lazy load heavy analytics components (recharts ~8MB)
const PerformanceWidget = dynamic(() => import('@/components/admin/analytics/PerformanceWidget'), {
  ssr: false,
});
const ConversionFunnel = dynamic(() => import('@/components/admin/analytics/ConversionFunnel'), {
  ssr: false,
});
const CohortAnalysis = dynamic(() => import('@/components/admin/analytics/CohortAnalysis'), {
  ssr: false,
});
const ABCAnalysis = dynamic(() => import('@/components/admin/analytics/ABCAnalysis'), {
  ssr: false,
});
const AlertsConfig = dynamic(() => import('@/components/admin/analytics/AlertsConfig'), {
  ssr: false,
});
const StockAnalytics = dynamic(() => import('@/components/admin/analytics/StockAnalytics'), {
  ssr: false,
});
const PriceAnalytics = dynamic(() => import('@/components/admin/analytics/PriceAnalytics'), {
  ssr: false,
});
const ChannelAnalytics = dynamic(() => import('@/components/admin/analytics/ChannelAnalytics'), {
  ssr: false,
});
const GeographyAnalytics = dynamic(
  () => import('@/components/admin/analytics/GeographyAnalytics'),
  { ssr: false },
);
const CustomerLTV = dynamic(() => import('@/components/admin/analytics/CustomerLTV'), {
  ssr: false,
});
const CustomerSegmentation = dynamic(
  () => import('@/components/admin/analytics/CustomerSegmentation'),
  { ssr: false },
);
const RFMAnalysis = dynamic(() => import('@/components/admin/analytics/RFMAnalysis'), {
  ssr: false,
});
const ChurnPrediction = dynamic(() => import('@/components/admin/analytics/ChurnPrediction'), {
  ssr: false,
});

type AnalyticsTab =
  | 'dashboard'
  | 'sales'
  | 'products'
  | 'clients'
  | 'orders'
  | 'performance'
  | 'funnel'
  | 'cohorts'
  | 'abc'
  | 'alerts'
  | 'stock'
  | 'price'
  | 'channels'
  | 'geography'
  | 'ltv'
  | 'segments'
  | 'rfm'
  | 'churn';

const SELF_CONTAINED_TABS: AnalyticsTab[] = [
  'performance',
  'funnel',
  'cohorts',
  'abc',
  'alerts',
  'stock',
  'price',
  'channels',
  'geography',
  'ltv',
  'segments',
  'rfm',
  'churn',
];

function NoData({ msg }: { msg?: string }) {
  const t = useTranslations('admin.analyticsPage');
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] py-12 text-center text-sm text-[var(--color-text-secondary)]">
      {msg ?? t('noData')}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const t = useTranslations('admin.analyticsPage');
  const [tab, setTab] = useState<AnalyticsTab>('dashboard');
  const [days, setDays] = useState(30);
  const [data, setData] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = useCallback(async () => {
    const pdfTabs = ['stock', 'price', 'channels', 'geography', 'ltv', 'segments'];
    const reportType = pdfTabs.includes(tab) ? tab : 'summary';
    setIsExporting(true);
    try {
      const res = await apiClient.post<{ url: string }>('/api/v1/admin/analytics/export-pdf', {
        reportType,
        days,
      });
      if (res.success && res.data?.url) {
        window.open(res.data.url, '_blank');
        toast.success(t('pdfGenerated'));
      } else {
        toast.error(res.error || t('pdfFailed'));
      }
    } catch {
      toast.error(t('pdfError'));
    } finally {
      setIsExporting(false);
    }
  }, [tab, days, t]);

  // CSV cell escaper. Excel/Sheets interpret cells starting with =/+/-/@/tab/CR
  // as formulas — a productName like `=cmd|'/c calc'!A0` would silently
  // execute on open. We neutralise with a leading single quote AND quote
  // any cell containing commas/quotes/newlines.
  const csvCell = useCallback((value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }, []);

  const exportCsv = useCallback(() => {
    if (!data || typeof data !== 'object') {
      toast.error(t('noDataExport'));
      return;
    }
    const d = data as Record<string, unknown>;
    let csv = '';
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `${tab}-${dateStamp}.csv`;

    if (tab === 'sales' && Array.isArray((d as { daily?: unknown }).daily)) {
      const daily = (d as { daily: { date: string; revenue: number; count: number }[] }).daily;
      csv =
        t('csvSalesHeader') +
        '\n' +
        daily
          .map((r) => [csvCell(r.date), csvCell(r.revenue.toFixed(2)), csvCell(r.count)].join(','))
          .join('\n');
    } else if (tab === 'orders' && Array.isArray((d as { statusCounts?: unknown }).statusCounts)) {
      const sc = (d as { statusCounts: { status: string; _count: number }[] }).statusCounts;
      csv =
        t('csvOrdersHeader') +
        '\n' +
        sc.map((s) => [csvCell(s.status), csvCell(s._count)].join(',')).join('\n');
    } else if (tab === 'products' && Array.isArray((d as { topProducts?: unknown }).topProducts)) {
      const tp = (
        d as {
          topProducts: {
            productCode: string;
            productName: string;
            _sum: { quantity: number; subtotal: number };
            _count: number;
          }[];
        }
      ).topProducts;
      csv =
        t('csvProductsHeader') +
        '\n' +
        tp
          .map((p) =>
            [
              csvCell(p.productCode),
              csvCell(p.productName),
              csvCell(p._sum.quantity),
              csvCell(Number(p._sum.subtotal).toFixed(2)),
              csvCell(p._count),
            ].join(','),
          )
          .join('\n');
    } else {
      toast.error(t('csvUnavailable'));
      return;
    }

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('csvDownloaded'));
  }, [data, tab, csvCell, t]);

  useEffect(() => {
    if (SELF_CONTAINED_TABS.includes(tab)) {
      setData(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setData(null);
    setIsLoading(true);
    apiClient
      .get(`/api/v1/admin/analytics?type=${tab}&days=${days}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setData(res.data);
        else toast.error(res.error || t('loadError'));
      })
      .catch(() => {
        if (!cancelled) toast.error(t('loadError'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, days, t]);

  const tabs: { key: AnalyticsTab; label: string }[] = [
    { key: 'dashboard', label: t('tab_dashboard') },
    { key: 'sales', label: t('tab_sales') },
    { key: 'products', label: t('tab_products') },
    { key: 'clients', label: t('tab_clients') },
    { key: 'orders', label: t('tab_orders') },
    { key: 'performance', label: t('tab_performance') },
    { key: 'funnel', label: t('tab_funnel') },
    { key: 'cohorts', label: t('tab_cohorts') },
    { key: 'abc', label: t('tab_abc') },
    { key: 'alerts', label: t('tab_alerts') },
    { key: 'stock', label: t('tab_stock') },
    { key: 'price', label: t('tab_price') },
    { key: 'channels', label: t('tab_channels') },
    { key: 'geography', label: t('tab_geography') },
    { key: 'ltv', label: t('tab_ltv') },
    { key: 'segments', label: t('tab_segments') },
    { key: 'rfm', label: t('tab_rfm') },
    { key: 'churn', label: t('tab_churn') },
  ];

  const canExportCsv = ['sales', 'products', 'orders'].includes(tab) && !!data;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/analytics/profit"
            className="inline-flex h-8 items-center rounded-[var(--radius)] border border-[var(--color-border)] px-3 text-sm font-medium"
          >
            💰 Прибуток
          </Link>
          {canExportCsv && (
            <Button size="sm" variant="outline" onClick={exportCsv}>
              {t('csv')}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={exportPdf} disabled={isExporting}>
            {isExporting ? t('exporting') : t('pdf')}
          </Button>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label={t('periodLabel')}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
          >
            <option value={7}>{t('days7')}</option>
            <option value={30}>{t('days30')}</option>
            <option value={90}>{t('days90')}</option>
          </select>
        </div>
      </div>

      <div className="mb-6 overflow-x-auto">
        <div
          className="flex gap-1 rounded-[var(--radius)] bg-[var(--color-bg-secondary)] p-1"
          style={{ minWidth: 'max-content' }}
        >
          {tabs.map((tabItem) => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key)}
              className={`whitespace-nowrap rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium transition-colors ${tab === tabItem.key ? 'bg-[var(--color-bg)] shadow-sm' : 'text-[var(--color-text-secondary)]'}`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : (
        <div>
          {tab === 'dashboard' && <DashboardView data={data} />}
          {tab === 'sales' && <SalesView data={data} />}
          {tab === 'products' && <ProductsView data={data} />}
          {tab === 'clients' && <ClientsView data={data} />}
          {tab === 'orders' && <OrdersView data={data} />}
          {tab === 'performance' && <PerformanceWidget days={days} />}
          {tab === 'funnel' && <ConversionFunnel days={days} />}
          {tab === 'cohorts' && <CohortAnalysis />}
          {tab === 'abc' && <ABCAnalysis days={days} />}
          {tab === 'alerts' && <AlertsConfig />}
          {tab === 'stock' && <StockAnalytics days={days} />}
          {tab === 'price' && <PriceAnalytics days={days} />}
          {tab === 'channels' && <ChannelAnalytics days={days} />}
          {tab === 'geography' && <GeographyAnalytics days={days} />}
          {tab === 'ltv' && <CustomerLTV days={days} />}
          {tab === 'segments' && <CustomerSegmentation />}
          {tab === 'rfm' && <RFMAnalysis days={days} />}
          {tab === 'churn' && <ChurnPrediction days={days} />}
        </div>
      )}
    </div>
  );
}

// ─── Change indicator ───
function Change({ value, suffix = '%' }: { value: number | null; suffix?: string }) {
  if (value === null) return null;
  const color =
    value > 0
      ? 'text-green-600'
      : value < 0
        ? 'text-red-500'
        : 'text-[var(--color-text-secondary)]';
  return (
    <span className={`text-xs font-medium ${color}`}>
      {value > 0 ? '+' : ''}
      {value}
      {suffix}
    </span>
  );
}

// ─── 1. Dashboard (KPI + Insights + Forecast) ───
function DashboardView({ data }: { data: unknown }) {
  const t = useTranslations('admin.analyticsPage');
  const d = data as {
    kpi: {
      revenue: number;
      revenueChange: number | null;
      orders: number;
      ordersChange: number | null;
      avgCheck: number;
      avgCheckChange: number | null;
      newUsers: number;
      newUsersChange: number | null;
      pendingOrders: number;
      lowStockCount: number;
    };
    insights: string[];
    forecast: { avgDaily: number; forecast7: number; forecast30: number };
  } | null;
  if (!d?.kpi) return <NoData />;

  const { kpi, insights, forecast } = d;
  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label={t('kpiRevenue')}
          value={formatPrice(kpi.revenue)}
          change={kpi.revenueChange}
        />
        <KpiCard label={t('kpiOrders')} value={kpi.orders} change={kpi.ordersChange} />
        <KpiCard
          label={t('kpiAvgCheck')}
          value={formatPrice(kpi.avgCheck)}
          change={kpi.avgCheckChange}
        />
        <KpiCard label={t('kpiNewUsers')} value={kpi.newUsers} change={kpi.newUsersChange} />
        <KpiCard label={t('kpiPending')} value={kpi.pendingOrders} warn={kpi.pendingOrders > 5} />
        <KpiCard label={t('kpiLowStock')} value={kpi.lowStockCount} warn={kpi.lowStockCount > 0} />
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-amber-800">{t('insightsTitle')}</h3>
          <ul className="space-y-1">
            {insights.map((text, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Forecast */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">{t('forecastTitle')}</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-[var(--color-text-secondary)]">{t('forecastAvgDay')}</p>
            <p className="text-xl font-bold">{formatPrice(forecast.avgDaily)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-secondary)]">{t('forecast7')}</p>
            <p className="text-xl font-bold">{formatPrice(forecast.forecast7)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-secondary)]">{t('forecast30')}</p>
            <p className="text-xl font-bold">{formatPrice(forecast.forecast30)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  change,
  warn,
}: {
  label: string;
  value: string | number;
  change?: number | null;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-[var(--radius)] border p-4 ${warn ? 'border-red-200 bg-red-50' : 'border-[var(--color-border)] bg-[var(--color-bg)]'}`}
    >
      <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className={`text-2xl font-bold ${warn ? 'text-red-600' : ''}`}>{value}</p>
        {change !== undefined && <Change value={change ?? null} />}
      </div>
    </div>
  );
}

// ─── 2. Sales (with comparison + line chart) ───
function SalesView({ data }: { data: unknown }) {
  const t = useTranslations('admin.analyticsPage');
  const d = data as {
    daily: { date: string; revenue: number; count: number }[];
    summary: { totalRevenue: number; totalOrders: number; avgCheck: number };
    comparison: { revenue: number | null; orders: number | null; avgCheck: number | null };
  } | null;
  if (!d?.daily || !d?.summary) return <NoData />;
  const { daily, summary, comparison } = d;
  const maxRevenue = Math.max(...daily.map((r) => r.revenue), 1);

  return (
    <div>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">{t('kpiRevenue')}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold">{formatPrice(summary.totalRevenue)}</p>
            <Change value={comparison?.revenue ?? null} />
          </div>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">{t('kpiOrders')}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold">{summary.totalOrders}</p>
            <Change value={comparison?.orders ?? null} />
          </div>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">{t('kpiAvgCheck')}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold">{formatPrice(summary.avgCheck)}</p>
            <Change value={comparison?.avgCheck ?? null} />
          </div>
        </div>
      </div>

      {/* SVG Line chart */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-4 text-sm font-semibold">{t('salesByDay')}</h3>
        {daily.length > 1 ? (
          <svg
            viewBox={`0 0 ${daily.length * 30} 200`}
            className="h-48 w-full"
            preserveAspectRatio="none"
          >
            {/* Grid lines */}
            {[0, 50, 100, 150].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2={daily.length * 30}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth="0.5"
              />
            ))}
            {/* Area */}
            <path
              d={`M0,200 ${daily.map((d, i) => `L${i * 30},${200 - (d.revenue / maxRevenue) * 180}`).join(' ')} L${(daily.length - 1) * 30},200 Z`}
              fill="var(--color-primary)"
              opacity="0.1"
            />
            {/* Line */}
            <polyline
              points={daily
                .map((d, i) => `${i * 30},${200 - (d.revenue / maxRevenue) * 180}`)
                .join(' ')}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2"
            />
            {/* Dots */}
            {daily.map((d, i) => (
              <g key={d.date}>
                <circle
                  cx={i * 30}
                  cy={200 - (d.revenue / maxRevenue) * 180}
                  r="3"
                  fill="var(--color-primary)"
                />
                <title>
                  {t('chartPoint', {
                    date: d.date,
                    revenue: formatPrice(d.revenue),
                    count: d.count,
                  })}
                </title>
              </g>
            ))}
          </svg>
        ) : (
          <div className="flex items-end gap-1" style={{ height: 200 }}>
            {daily.map((d) => (
              <div key={d.date} className="group relative flex-1">
                <div
                  className="w-full rounded-t bg-[var(--color-primary)]"
                  style={{ height: `${(d.revenue / maxRevenue) * 100}%`, minHeight: 2 }}
                />
                <div className="absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                  {t('chartPoint', {
                    date: d.date,
                    revenue: formatPrice(d.revenue),
                    count: d.count,
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 3. Products (with margins) ───
function ProductsView({ data }: { data: unknown }) {
  const t = useTranslations('admin.analyticsPage');
  const d = data as {
    topProducts: {
      productCode: string;
      productName: string;
      _sum: { quantity: number; subtotal: number };
      _count: number;
    }[];
    zeroSales: number;
    margins: {
      id: number;
      name: string;
      code: string;
      retail: number;
      wholesale: number;
      marginPct: number;
    }[];
  } | null;
  if (!d?.topProducts) return <NoData />;

  return (
    <div>
      <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <p className="text-sm">
          {t('zeroSalesPre')}
          <strong className="text-[var(--color-danger)]">{d.zeroSales}</strong>
        </p>
      </div>

      <h3 className="mb-3 text-sm font-semibold">{t('top20')}</h3>
      <div className="mb-6 overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              <th className="px-4 py-2 text-left">{t('thCode')}</th>
              <th className="px-4 py-2 text-left">{t('thName')}</th>
              <th className="px-4 py-2 text-right">{t('thQty')}</th>
              <th className="px-4 py-2 text-right">{t('thSum')}</th>
              <th className="px-4 py-2 text-right">{t('thOrders')}</th>
            </tr>
          </thead>
          <tbody>
            {d.topProducts.map((p, i) => (
              <tr key={i} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2 text-xs">{p.productCode}</td>
                <td className="px-4 py-2 text-xs">{p.productName}</td>
                <td className="px-4 py-2 text-right text-xs">{p._sum.quantity}</td>
                <td className="px-4 py-2 text-right text-xs">
                  {formatPrice(Number(p._sum.subtotal))}
                </td>
                <td className="px-4 py-2 text-right text-xs">{p._count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Margins */}
      {d.margins && d.margins.length > 0 && (
        <>
          <h3 className="mb-3 text-sm font-semibold">{t('marginsTitle')}</h3>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg-secondary)]">
                <tr>
                  <th className="px-4 py-2 text-left">{t('thCode')}</th>
                  <th className="px-4 py-2 text-left">{t('thName')}</th>
                  <th className="px-4 py-2 text-right">{t('thRetail')}</th>
                  <th className="px-4 py-2 text-right">{t('thWholesale')}</th>
                  <th className="px-4 py-2 text-right">{t('thMargin')}</th>
                </tr>
              </thead>
              <tbody>
                {d.margins.map((m) => (
                  <tr key={m.id} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-2 text-xs">{m.code}</td>
                    <td className="px-4 py-2 text-xs">{m.name}</td>
                    <td className="px-4 py-2 text-right text-xs">{formatPrice(m.retail)}</td>
                    <td className="px-4 py-2 text-right text-xs">{formatPrice(m.wholesale)}</td>
                    <td className="px-4 py-2 text-right text-xs">
                      <span
                        className={
                          m.marginPct < 20
                            ? 'text-red-500 font-bold'
                            : m.marginPct > 40
                              ? 'text-green-600 font-bold'
                              : ''
                        }
                      >
                        {m.marginPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── 4. Clients (with wholesale group comparison) ───
function ClientsView({ data }: { data: unknown }) {
  const t = useTranslations('admin.analyticsPage');
  const d = data as {
    totalUsers: number;
    newUsers: number;
    wholesalers: number;
    topClients: {
      _sum: { totalAmount: number };
      _count: number;
      client: { fullName: string | null; email: string; companyName: string | null } | null;
    }[];
    comparison: { newUsers: number | null };
    wholesaleGroupStats: {
      group: number;
      orders: number;
      revenue: number;
      customers: number;
      avgCheck: number;
    }[];
  } | null;
  if (!d?.topClients) return <NoData />;

  return (
    <div>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">{t('totalUsers')}</p>
          <p className="text-2xl font-bold">{d.totalUsers}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">{t('newInPeriod')}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold">{d.newUsers}</p>
            <Change value={d.comparison?.newUsers ?? null} />
          </div>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">{t('wholesalers')}</p>
          <p className="text-2xl font-bold">{d.wholesalers}</p>
        </div>
      </div>

      {/* Wholesale group comparison */}
      {d.wholesaleGroupStats && d.wholesaleGroupStats.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold">{t('wholesaleComparison')}</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {d.wholesaleGroupStats.map((gs) => (
              <div
                key={gs.group}
                className={`rounded-[var(--radius)] border p-4 ${
                  gs.group === 1
                    ? 'border-blue-200 bg-blue-50'
                    : gs.group === 2
                      ? 'border-violet-200 bg-violet-50'
                      : 'border-amber-200 bg-amber-50'
                }`}
              >
                <p className="text-sm font-semibold">
                  {WHOLESALE_GROUP_LABELS[gs.group as WholesaleGroup]}
                </p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>{t('customersLabel')}</span>
                    <b>{gs.customers}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('ordersLabel')}</span>
                    <b>{gs.orders}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('revenueLabel')}</span>
                    <b>{formatPrice(gs.revenue)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('avgCheckLabel')}</span>
                    <b>{formatPrice(gs.avgCheck)}</b>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 className="mb-3 text-sm font-semibold">{t('topClients')}</h3>
      <div className="space-y-2">
        {d.topClients.map((c, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3"
          >
            <span className="text-sm font-bold text-[var(--color-text-secondary)]">#{i + 1}</span>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {c.client?.fullName || c.client?.email || t('unknown')}
              </p>
              {c.client?.companyName && (
                <p className="text-xs text-[var(--color-text-secondary)]">{c.client.companyName}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{formatPrice(Number(c._sum.totalAmount))}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t('ordersCountSuffix', { count: c._count })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 5. Orders (with cancellations + heatmap) ───
function OrdersView({ data }: { data: unknown }) {
  const t = useTranslations('admin.analyticsPage');
  const DAY_NAMES = [
    t('day_sun'),
    t('day_mon'),
    t('day_tue'),
    t('day_wed'),
    t('day_thu'),
    t('day_fri'),
    t('day_sat'),
  ];
  const d = data as {
    statusCounts: { status: string; _count: number }[];
    deliveryCounts: { deliveryMethod: string; _count: number }[];
    paymentCounts: { paymentMethod: string; _count: number }[];
    cancellationReasons: { reason: string; count: number }[];
    cancelRate: number;
    returnRate: number;
    heatmap: number[][];
  } | null;
  if (!d?.statusCounts) return <NoData />;

  const maxHeat = d.heatmap ? Math.max(...d.heatmap.flat(), 1) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold">{t('byStatus')}</h3>
        <div className="flex flex-wrap gap-2">
          {d.statusCounts.map((s) => (
            <div
              key={s.status}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2"
            >
              <p className="text-xs text-[var(--color-text-secondary)]">{s.status}</p>
              <p className="text-lg font-bold">{s._count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cancel/return rates */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-4">
          <p className="text-xs text-red-600">{t('cancellations')}</p>
          <p className="text-2xl font-bold text-red-700">{d.cancelRate}%</p>
        </div>
        <div className="rounded-[var(--radius)] border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs text-orange-600">{t('returns')}</p>
          <p className="text-2xl font-bold text-orange-700">{d.returnRate}%</p>
        </div>
      </div>

      {/* Cancellation reasons */}
      {d.cancellationReasons && d.cancellationReasons.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">{t('cancelReturnReasons')}</h3>
          <div className="space-y-1">
            {d.cancellationReasons.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2"
              >
                <span className="flex-1 text-sm">{r.reason}</span>
                <span className="text-sm font-bold">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap */}
      {d.heatmap && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">{t('heatmapTitle')}</h3>
          <div className="overflow-x-auto">
            <table className="text-[10px]">
              <thead>
                <tr>
                  <th className="px-1 py-0.5" />
                  {Array.from({ length: 24 }, (_, h) => (
                    <th
                      key={h}
                      className="px-1 py-0.5 text-center text-[var(--color-text-secondary)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.heatmap.map((row, dayIdx) => (
                  <tr key={dayIdx}>
                    <td className="pr-2 text-right font-medium text-[var(--color-text-secondary)]">
                      {DAY_NAMES[dayIdx]}
                    </td>
                    {row.map((val, h) => {
                      const intensity = val / maxHeat;
                      return (
                        <td key={h} className="p-0.5">
                          <div
                            className="h-5 w-5 rounded-sm"
                            style={{
                              backgroundColor: `rgba(59, 130, 246, ${Math.max(intensity, 0.05)})`,
                            }}
                            title={t('heatmapCell', {
                              day: DAY_NAMES[dayIdx],
                              hour: h,
                              count: val,
                            })}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold">{t('byDelivery')}</h3>
        <div className="flex flex-wrap gap-2">
          {d.deliveryCounts.map((dc) => (
            <div
              key={dc.deliveryMethod}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2"
            >
              <p className="text-xs text-[var(--color-text-secondary)]">{dc.deliveryMethod}</p>
              <p className="text-lg font-bold">{dc._count}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">{t('byPayment')}</h3>
        <div className="flex flex-wrap gap-2">
          {d.paymentCounts.map((p) => (
            <div
              key={p.paymentMethod}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2"
            >
              <p className="text-xs text-[var(--color-text-secondary)]">{p.paymentMethod}</p>
              <p className="text-lg font-bold">{p._count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
