'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import UsageMeter from '@/components/admin/UsageMeter';

interface Plan {
  id: number;
  name: string;
  slug: string;
  priceMonthly: number;
  priceYearly: number;
}

interface Billing {
  id: number;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  plan: Plan;
}

interface Usage {
  products: { used: number; max: number };
  orders: { used: number; max: number };
}

interface Invoice {
  id: number;
  amount: number;
  currency: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  pdfUrl: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  trial: 'Пробний період',
  active: 'Активний',
  past_due: 'Прострочено',
  cancelled: 'Скасовано',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Чернетка',
  sent: 'Надіслано',
  paid: 'Оплачено',
  overdue: 'Прострочено',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA');
}

export default function AdminBillingPage() {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.get<{ billing: Billing; usage: Usage }>('/api/v1/admin/billing'),
      apiClient.get<Invoice[]>('/api/v1/admin/billing/invoices'),
    ])
      .then(([billingRes, invoicesRes]) => {
        if (cancelled) return;
        if (billingRes.success && billingRes.data) {
          setBilling(billingRes.data.billing);
          setUsage(billingRes.data.usage);
        } else {
          toast.error(billingRes.error || 'Помилка завантаження даних біллінгу');
        }
        if (invoicesRes.success && invoicesRes.data) {
          setInvoices(invoicesRes.data);
        } else {
          toast.error(invoicesRes.error || 'Помилка завантаження інвойсів');
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('Помилка завантаження даних біллінгу');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (!billing) {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-center">
        <p className="text-[var(--color-text-secondary)]">Біллінг ще не налаштовано.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Біллінг</h2>
        <Link href="/admin/billing/plans">
          <Button>Змінити план</Button>
        </Link>
      </div>

      {/* Current plan info */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
        <h3 className="mb-3 text-lg font-semibold">Поточний план</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-xs text-[var(--color-text-secondary)]">План</span>
            <p className="text-sm font-medium">{billing.plan.name}</p>
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-secondary)]">Ціна</span>
            <p className="text-sm font-medium">{billing.plan.priceMonthly} грн/міс</p>
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-secondary)]">Статус</span>
            <p className="text-sm font-medium">{STATUS_LABELS[billing.status] || billing.status}</p>
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-secondary)]">Період</span>
            <p className="text-sm font-medium">
              {formatDate(billing.currentPeriodStart)} — {formatDate(billing.currentPeriodEnd)}
            </p>
          </div>
        </div>
        {billing.trialEndsAt && billing.status === 'trial' && (
          <p className="mt-3 text-sm text-yellow-600">
            Пробний період закінчується: {formatDate(billing.trialEndsAt)}
          </p>
        )}
      </div>

      {/* Usage meters */}
      {usage && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <UsageMeter
            label="Товари"
            used={usage.products.used}
            max={usage.products.max}
          />
          <UsageMeter
            label="Замовлення (за період)"
            used={usage.orders.used}
            max={usage.orders.max}
          />
        </div>
      )}

      {/* Invoice history */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
        <h3 className="mb-3 text-lg font-semibold">Історія рахунків</h3>
        {invoices.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Рахунків поки немає.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="pb-2 font-medium text-[var(--color-text-secondary)]">Дата</th>
                  <th className="pb-2 font-medium text-[var(--color-text-secondary)]">Період</th>
                  <th className="pb-2 font-medium text-[var(--color-text-secondary)]">Сума</th>
                  <th className="pb-2 font-medium text-[var(--color-text-secondary)]">Статус</th>
                  <th className="pb-2 font-medium text-[var(--color-text-secondary)]">PDF</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2">{formatDate(inv.createdAt)}</td>
                    <td className="py-2">
                      {formatDate(inv.periodStart)} — {formatDate(inv.periodEnd)}
                    </td>
                    <td className="py-2">
                      {inv.amount} {inv.currency}
                    </td>
                    <td className="py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          inv.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : inv.status === 'overdue'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {INVOICE_STATUS_LABELS[inv.status] || inv.status}
                      </span>
                    </td>
                    <td className="py-2">
                      {inv.pdfUrl ? (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--color-primary)] hover:underline"
                        >
                          Завантажити
                        </a>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
