'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import dynamic from 'next/dynamic';

const FinanceChart = dynamic(() => import('./FinanceChart'), { ssr: false });

interface OrderData {
  id: number;
  totalAmount: string;
  createdAt: string;
  orderNumber: string;
  status: string;
}

interface DocumentItem {
  orderId: number;
  orderNumber: string;
  date: string;
  amount: number;
  status: string;
}

interface FinanceData {
  totalPurchases: number;
  monthPurchases: number;
  orderCount: number;
  monthOrderCount: number;
  avgCheck: number;
  monthlyData: { month: string; sum: number; count: number }[];
  documents: DocumentItem[];
}

function buildFinanceData(orders: OrderData[]): FinanceData {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalPurchases = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
  const monthOrders = orders.filter((o) => new Date(o.createdAt) >= monthStart);
  const monthPurchases = monthOrders.reduce((s, o) => s + Number(o.totalAmount), 0);

  // Build monthly aggregation for last 12 months
  const monthlyMap = new Map<string, { sum: number; count: number }>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap.set(key, { sum: 0, count: 0 });
  }
  for (const o of orders) {
    const d = new Date(o.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = monthlyMap.get(key);
    if (entry) {
      entry.sum += Number(o.totalAmount);
      entry.count += 1;
    }
  }
  const monthlyData = Array.from(monthlyMap.entries()).map(([month, data]) => ({
    month,
    sum: Math.round(data.sum),
    count: data.count,
  }));

  // Documents (last 50 orders as archive)
  const documents: DocumentItem[] = orders.slice(0, 50).map((o) => ({
    orderId: o.id,
    orderNumber: o.orderNumber,
    date: new Date(o.createdAt).toLocaleDateString('uk-UA'),
    amount: Number(o.totalAmount),
    status: o.status,
  }));

  return {
    totalPurchases,
    monthPurchases,
    orderCount: orders.length,
    monthOrderCount: monthOrders.length,
    avgCheck: orders.length > 0 ? totalPurchases / orders.length : 0,
    monthlyData,
    documents,
  };
}

const STATUS_LABELS: Record<string, string> = {
  new_order: 'Нове',
  processing: 'В обробці',
  confirmed: 'Підтверджено',
  paid: 'Оплачено',
  shipped: 'Відправлено',
  completed: 'Завершено',
  cancelled: 'Скасовано',
  returned: 'Повернено',
};

export default function AccountFinancePage() {
  const { user } = useAuth();
  const [data, setData] = useState<FinanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents'>('overview');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  useEffect(() => {
    apiClient
      .get<OrderData[]>('/api/v1/orders?page=1&limit=1000')
      .then((res) => {
        if (res.success && res.data) {
          const orders = Array.isArray(res.data) ? res.data : [];
          setData(buildFinanceData(orders));
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleDownloadPdf = async (orderId: number, orderNumber: string) => {
    setDownloadingId(orderId);
    try {
      const res = await apiClient.post<{ url: string }>(`/api/v1/orders/${orderId}/invoice`);
      if (res.success && res.data?.url) {
        const link = document.createElement('a');
        link.href = res.data.url;
        link.download = `invoice-${orderNumber}.pdf`;
        link.click();
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadAll = async () => {
    if (!data) return;
    setDownloadingAll(true);
    try {
      const completedDocs = data.documents.filter(
        (d) => d.status === 'completed' || d.status === 'paid' || d.status === 'shipped'
      );
      for (const doc of completedDocs) {
        await handleDownloadPdf(doc.orderId, doc.orderNumber);
      }
    } finally {
      setDownloadingAll(false);
    }
  };

  if (user?.role !== 'wholesaler' && user?.role !== 'admin') {
    return (
      <div className="py-8 text-center text-[var(--color-text-secondary)]">
        Розділ доступний тільки для оптових клієнтів
      </div>
    );
  }

  if (isLoading || !data) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold">Фінанси</h2>

      {/* Stat cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Загальна сума закупівель" value={`${data.totalPurchases.toFixed(0)} грн`} />
        <StatCard label="Цього місяця" value={`${data.monthPurchases.toFixed(0)} грн`} />
        <StatCard label="Середній чек" value={`${data.avgCheck.toFixed(0)} грн`} />
        <StatCard label="Всього замовлень" value={String(data.orderCount)} />
        <StatCard label="Замовлень цього місяця" value={String(data.monthOrderCount)} />
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b border-[var(--color-border)]">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          Графіки
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'documents'
              ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          Архів документів
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <h3 className="mb-3 text-sm font-semibold">Витрати по місяцях (грн)</h3>
            <FinanceChart data={data.monthlyData} dataKey="sum" color="var(--color-primary)" />
          </div>
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <h3 className="mb-3 text-sm font-semibold">Кількість замовлень по місяцях</h3>
            <FinanceChart data={data.monthlyData} dataKey="count" color="var(--color-accent, #06b6d4)" />
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <h3 className="text-sm font-semibold">Документи</h3>
            {data.documents.length > 0 && (
              <Button size="sm" variant="secondary" onClick={handleDownloadAll} isLoading={downloadingAll}>
                Завантажити всі
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left">
                  <th className="px-4 py-3 font-medium text-[var(--color-text-secondary)]">Замовлення</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-secondary)]">Дата</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-secondary)]">Сума</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-secondary)]">Статус</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-secondary)]">Документи</th>
                </tr>
              </thead>
              <tbody>
                {data.documents.map((doc) => (
                  <tr key={doc.orderNumber} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">#{doc.orderNumber}</td>
                    <td className="px-4 py-3">{doc.date}</td>
                    <td className="px-4 py-3 font-semibold">{doc.amount.toFixed(0)} грн</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs">
                        {STATUS_LABELS[doc.status] || doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDownloadPdf(doc.orderId, doc.orderNumber)}
                        disabled={downloadingId === doc.orderId}
                        className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
                      >
                        {downloadingId === doc.orderId ? (
                          <Spinner size="sm" />
                        ) : (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
                {data.documents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                      Документів немає
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
