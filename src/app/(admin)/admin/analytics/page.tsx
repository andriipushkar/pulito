'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import PerformanceWidget from '@/components/admin/analytics/PerformanceWidget';
import ConversionFunnel from '@/components/admin/analytics/ConversionFunnel';
import CohortAnalysis from '@/components/admin/analytics/CohortAnalysis';
import ABCAnalysis from '@/components/admin/analytics/ABCAnalysis';
import AlertsConfig from '@/components/admin/analytics/AlertsConfig';
import StockAnalytics from '@/components/admin/analytics/StockAnalytics';
import PriceAnalytics from '@/components/admin/analytics/PriceAnalytics';
import ChannelAnalytics from '@/components/admin/analytics/ChannelAnalytics';
import GeographyAnalytics from '@/components/admin/analytics/GeographyAnalytics';
import CustomerLTV from '@/components/admin/analytics/CustomerLTV';
import CustomerSegmentation from '@/components/admin/analytics/CustomerSegmentation';

interface DailySales {
  date: string;
  revenue: number;
  count: number;
}

interface SalesSummary {
  totalRevenue: number;
  totalOrders: number;
  avgCheck: number;
}

interface TopProduct {
  productId: number;
  productName: string;
  productCode: string;
  _sum: { quantity: number; subtotal: number };
  _count: number;
}

type AnalyticsTab = 'sales' | 'products' | 'clients' | 'orders' | 'performance' | 'funnel' | 'cohorts' | 'abc' | 'alerts' | 'stock' | 'price' | 'channels' | 'geography' | 'ltv' | 'segments';

const SELF_CONTAINED_TABS: AnalyticsTab[] = ['performance', 'funnel', 'cohorts', 'abc', 'alerts', 'stock', 'price', 'channels', 'geography', 'ltv', 'segments'];

export default function AdminAnalyticsPage() {
  const [tab, setTab] = useState<AnalyticsTab>('sales');
  const [days, setDays] = useState(30);
  const [data, setData] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = useCallback(async () => {
    const pdfTabs = ['stock', 'price', 'channels', 'geography', 'ltv', 'segments'];
    const reportType = pdfTabs.includes(tab) ? tab : 'summary';
    setIsExporting(true);
    try {
      const res = await apiClient.post<{ url: string }>('/api/v1/admin/analytics/export-pdf', { reportType, days });
      if (res.success && res.data?.url) {
        window.open(res.data.url, '_blank');
      }
    } finally {
      setIsExporting(false);
    }
  }, [tab, days]);

  useEffect(() => {
    if (SELF_CONTAINED_TABS.includes(tab)) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    apiClient.get(`/api/v1/admin/analytics?type=${tab}&days=${days}`)
      .then((res) => { if (res.success && res.data) setData(res.data); })
      .finally(() => setIsLoading(false));
  }, [tab, days]);

  const tabs: { key: AnalyticsTab; label: string }[] = [
    { key: 'sales', label: 'Продажі' },
    { key: 'products', label: 'Товари' },
    { key: 'clients', label: 'Клієнти' },
    { key: 'orders', label: 'Замовлення' },
    { key: 'performance', label: 'Продуктивність' },
    { key: 'funnel', label: 'Воронка' },
    { key: 'cohorts', label: 'Когорти' },
    { key: 'abc', label: 'ABC-аналіз' },
    { key: 'alerts', label: 'Сповіщення' },
    { key: 'stock', label: 'Залишки' },
    { key: 'price', label: 'Ціни' },
    { key: 'channels', label: 'Канали' },
    { key: 'geography', label: 'Географія' },
    { key: 'ltv', label: 'LTV' },
    { key: 'segments', label: 'Сегменти' },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Аналітика</h2>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={exportPdf}
            disabled={isExporting}
          >
            {isExporting ? 'Експорт...' : 'PDF'}
          </Button>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
          >
            <option value={7}>7 днів</option>
            <option value={30}>30 днів</option>
            <option value={90}>90 днів</option>
          </select>
        </div>
      </div>

      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-1 rounded-[var(--radius)] bg-[var(--color-bg-secondary)] p-1" style={{ minWidth: 'max-content' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? 'bg-[var(--color-bg)] shadow-sm' : 'text-[var(--color-text-secondary)]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="md" /></div>
      ) : (
        <div>
          {tab === 'sales' && <SalesView data={data as { daily: DailySales[]; summary: SalesSummary }} />}
          {tab === 'products' && <ProductsView data={data as { topProducts: TopProduct[]; zeroSales: number }} />}
          {tab === 'clients' && <ClientsView data={data as { totalUsers: number; newUsers: number; wholesalers: number; topClients: unknown[] }} />}
          {tab === 'orders' && <OrdersView data={data as { statusCounts: { status: string; _count: number }[]; deliveryCounts: { deliveryMethod: string; _count: number }[]; paymentCounts: { paymentMethod: string; _count: number }[] }} />}
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
        </div>
      )}
    </div>
  );
}

function SalesView({ data }: { data: { daily: DailySales[]; summary: SalesSummary } }) {
  if (!data) return null;
  const { daily, summary } = data;
  const maxRevenue = Math.max(...daily.map((d) => d.revenue), 1);

  return (
    <div>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Виручка</p>
          <p className="text-2xl font-bold">{summary.totalRevenue.toFixed(0)} грн</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Замовлень</p>
          <p className="text-2xl font-bold">{summary.totalOrders}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Середній чек</p>
          <p className="text-2xl font-bold">{summary.avgCheck.toFixed(0)} грн</p>
        </div>
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-4 text-sm font-semibold">Продажі по дням</h3>
        <div className="flex items-end gap-1" style={{ height: 200 }}>
          {daily.map((d) => (
            <div key={d.date} className="group relative flex-1">
              <div
                className="w-full rounded-t bg-[var(--color-primary)]"
                style={{ height: `${(d.revenue / maxRevenue) * 100}%`, minHeight: 2 }}
              />
              <div className="absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                {d.date}: {d.revenue.toFixed(0)} грн ({d.count} зам.)
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductsView({ data }: { data: { topProducts: TopProduct[]; zeroSales: number } }) {
  if (!data) return null;
  return (
    <div>
      <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <p className="text-sm">Товарів без продажів за період: <strong className="text-[var(--color-danger)]">{data.zeroSales}</strong></p>
      </div>

      <h3 className="mb-3 text-sm font-semibold">Топ-20 товарів</h3>
      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              <th className="px-4 py-2 text-left">Код</th>
              <th className="px-4 py-2 text-left">Назва</th>
              <th className="px-4 py-2 text-right">К-ть</th>
              <th className="px-4 py-2 text-right">Сума</th>
              <th className="px-4 py-2 text-right">Замовлень</th>
            </tr>
          </thead>
          <tbody>
            {data.topProducts.map((p, i) => (
              <tr key={i} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2 text-xs">{p.productCode}</td>
                <td className="px-4 py-2 text-xs">{p.productName}</td>
                <td className="px-4 py-2 text-right text-xs">{p._sum.quantity}</td>
                <td className="px-4 py-2 text-right text-xs">{Number(p._sum.subtotal).toFixed(0)} грн</td>
                <td className="px-4 py-2 text-right text-xs">{p._count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClientsView({ data }: { data: { totalUsers: number; newUsers: number; wholesalers: number; topClients: unknown[] } }) {
  if (!data) return null;
  return (
    <div>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Всього користувачів</p>
          <p className="text-2xl font-bold">{data.totalUsers}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Нових за період</p>
          <p className="text-2xl font-bold">{data.newUsers}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Оптовиків</p>
          <p className="text-2xl font-bold">{data.wholesalers}</p>
        </div>
      </div>

      <h3 className="mb-3 text-sm font-semibold">Топ клієнтів за сумою</h3>
      <div className="space-y-2">
        {(data.topClients as { _sum: { totalAmount: number }; _count: number; client: { fullName: string | null; email: string; companyName: string | null } | null }[]).map((c, i) => (
          <div key={i} className="flex items-center gap-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
            <span className="text-sm font-bold text-[var(--color-text-secondary)]">#{i + 1}</span>
            <div className="flex-1">
              <p className="text-sm font-medium">{c.client?.fullName || c.client?.email || 'Невідомий'}</p>
              {c.client?.companyName && <p className="text-xs text-[var(--color-text-secondary)]">{c.client.companyName}</p>}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{Number(c._sum.totalAmount).toFixed(0)} грн</p>
              <p className="text-xs text-[var(--color-text-secondary)]">{c._count} замовлень</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrdersView({ data }: { data: { statusCounts: { status: string; _count: number }[]; deliveryCounts: { deliveryMethod: string; _count: number }[]; paymentCounts: { paymentMethod: string; _count: number }[] } }) {
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold">За статусом</h3>
        <div className="flex flex-wrap gap-2">
          {data.statusCounts.map((s) => (
            <div key={s.status} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2">
              <p className="text-xs text-[var(--color-text-secondary)]">{s.status}</p>
              <p className="text-lg font-bold">{s._count}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">За способом доставки</h3>
        <div className="flex flex-wrap gap-2">
          {data.deliveryCounts.map((d) => (
            <div key={d.deliveryMethod} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2">
              <p className="text-xs text-[var(--color-text-secondary)]">{d.deliveryMethod}</p>
              <p className="text-lg font-bold">{d._count}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">За способом оплати</h3>
        <div className="flex flex-wrap gap-2">
          {data.paymentCounts.map((p) => (
            <div key={p.paymentMethod} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2">
              <p className="text-xs text-[var(--color-text-secondary)]">{p.paymentMethod}</p>
              <p className="text-lg font-bold">{p._count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
