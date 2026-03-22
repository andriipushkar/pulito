'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';

interface Subscription {
  id: number;
  userName: string;
  userEmail: string;
  frequency: string;
  status: 'active' | 'paused' | 'cancelled';
  nextDelivery: string | null;
  itemsCount: number;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Активна',
  paused: 'Призупинена',
  cancelled: 'Скасована',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Щотижня',
  biweekly: 'Раз на 2 тижні',
  monthly: 'Щомісяця',
};

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const loadSubscriptions = () => {
    setIsLoading(true);
    const params = statusFilter ? `?status=${statusFilter}` : '';
    apiClient
      .get<Subscription[]>(`/api/v1/admin/subscriptions${params}`)
      .then((res) => {
        if (res.success && res.data) setSubscriptions(res.data);
        else toast.error('Не вдалося завантажити підписки');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadSubscriptions(); }, [statusFilter]);

  if (isLoading) {
    return <AdminTableSkeleton rows={6} columns={7} />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">
          Підписки <span className="text-base font-normal text-[var(--color-text-secondary)]">({subscriptions.length})</span>
        </h2>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          >
            <option value="">Всі статуси</option>
            <option value="active">Активні</option>
            <option value="paused">Призупинені</option>
            <option value="cancelled">Скасовані</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <th className="px-4 py-3 text-left font-medium">Користувач</th>
              <th className="px-4 py-3 text-left font-medium">Частота</th>
              <th className="px-4 py-3 text-center font-medium">Статус</th>
              <th className="px-4 py-3 text-left font-medium">Наступна доставка</th>
              <th className="px-4 py-3 text-right font-medium">Товарів</th>
              <th className="px-4 py-3 text-left font-medium">Створено</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((sub) => (
              <tr key={sub.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]">
                <td className="px-4 py-3">
                  <div>
                    <span className="font-medium">{sub.userName}</span>
                    <span className="ml-2 text-xs text-[var(--color-text-secondary)]">{sub.userEmail}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {FREQUENCY_LABELS[sub.frequency] || sub.frequency}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[sub.status] || 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABELS[sub.status] || sub.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {sub.nextDelivery ? new Date(sub.nextDelivery).toLocaleDateString('uk-UA') : '—'}
                </td>
                <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">{sub.itemsCount}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {new Date(sub.createdAt).toLocaleDateString('uk-UA')}
                </td>
              </tr>
            ))}
            {subscriptions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                  Підписок немає
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
