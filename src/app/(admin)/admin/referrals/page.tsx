'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';

interface Referral {
  id: number;
  referrer: { id: number; fullName: string; email: string };
  referred: { id: number; fullName: string; email: string };
  referralCode: string;
  status: string;
  bonusType: string | null;
  bonusValue: number | null;
  createdAt: string;
  convertedAt: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  registered: 'Зареєстровано',
  first_order: 'Перше замовлення',
  bonus_granted: 'Бонус нараховано',
};

export default function AdminReferralsPage() {
  const [items, setItems] = useState<Referral[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter) params.set('status', statusFilter);

    const res = await apiClient.get<Referral[]>(`/api/v1/admin/referrals?${params}`);
    if (res.success && res.data) {
      setItems(res.data);
      setTotal((res as unknown as { pagination: { total: number } }).pagination?.total || 0);
    }
    setIsLoading(false);
  }, [page, statusFilter]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter) params.set('status', statusFilter);

    apiClient.get<Referral[]>(`/api/v1/admin/referrals?${params}`).then((res) => {
      if (res.success && res.data) {
        setItems(res.data);
        setTotal((res as unknown as { pagination: { total: number } }).pagination?.total || 0);
      }
      setIsLoading(false);
    });
  }, [page, statusFilter]);

  const handleGrantBonus = async (id: number) => {
    const value = prompt('Сума бонусу:');
    if (!value) return;

    await apiClient.post(`/api/v1/admin/referrals/${id}/bonus`, {
      bonusType: 'cashback',
      bonusValue: parseFloat(value),
    });
    fetchData();
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Реферали</h2>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
        >
          <option value="">Усі статуси</option>
          <option value="registered">Зареєстровано</option>
          <option value="first_order">Перше замовлення</option>
          <option value="bonus_granted">Бонус нараховано</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              <th className="px-4 py-2 text-left">Реферер</th>
              <th className="px-4 py-2 text-left">Запрошений</th>
              <th className="px-4 py-2 text-left">Код</th>
              <th className="px-4 py-2 text-left">Статус</th>
              <th className="px-4 py-2 text-right">Бонус</th>
              <th className="px-4 py-2 text-left">Дата</th>
              <th className="px-4 py-2 text-right">Дії</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2 text-xs">{item.referrer.fullName || item.referrer.email}</td>
                <td className="px-4 py-2 text-xs">{item.referred.fullName || item.referred.email}</td>
                <td className="px-4 py-2 text-xs font-mono">{item.referralCode}</td>
                <td className="px-4 py-2 text-xs">{STATUS_LABELS[item.status] || item.status}</td>
                <td className="px-4 py-2 text-right text-xs">
                  {item.bonusValue ? `${Number(item.bonusValue).toFixed(0)} ₴` : '—'}
                </td>
                <td className="px-4 py-2 text-xs">{new Date(item.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right">
                  {item.status !== 'bonus_granted' && (
                    <button
                      onClick={() => handleGrantBonus(item.id)}
                      className="text-xs text-[var(--color-primary)] hover:underline"
                    >
                      Нарахувати бонус
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">Немає рефералів</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Назад</Button>
          <span className="px-3 py-2 text-sm">Сторінка {page}</span>
          <Button onClick={() => setPage((p) => p + 1)} disabled={items.length < 20}>Далі</Button>
        </div>
      )}
    </div>
  );
}
