'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { formatPrice } from '@/utils/format';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';

interface ReferralStats {
  total: number;
  registered: number;
  firstOrder: number;
  bonusGranted: number;
  bonusPaid: number;
}

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
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [bonusModal, setBonusModal] = useState<{ id: number; name: string } | null>(null);
  const [bonusValue, setBonusValue] = useState('');
  const [isGranting, setIsGranting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter) params.set('status', statusFilter);

    const res = await apiClient.get<Referral[]>(`/api/v1/admin/referrals?${params}`);
    if (res.success && res.data) {
      setItems(res.data);
      setTotal((res as unknown as { pagination: { total: number } }).pagination?.total || 0);
    }
    setIsLoading(false);
  }, [page, statusFilter]);

  const fetchStats = useCallback(() => {
    apiClient.get<ReferralStats>('/api/v1/admin/referrals?stats=true').then((res) => {
      if (res.success && res.data) setStats(res.data);
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleGrantBonus = async () => {
    if (!bonusModal || !bonusValue) return;
    const numValue = parseFloat(bonusValue);
    if (isNaN(numValue) || numValue <= 0) {
      toast.error('Введіть коректну суму бонусу');
      return;
    }

    setIsGranting(true);
    try {
      const res = await apiClient.post(`/api/v1/admin/referrals/${bonusModal.id}/bonus`, {
        bonusType: 'cashback',
        bonusValue: numValue,
      });
      if (res.success) {
        toast.success(`Бонус ${numValue} грн нараховано для ${bonusModal.name}`);
        setBonusModal(null);
        setBonusValue('');
        fetchData();
        fetchStats();
      } else {
        toast.error(res.error || 'Помилка нарахування бонусу');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsGranting(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Реферали <span className="text-base font-normal text-[var(--color-text-secondary)]">({total})</span></h2>
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

      {stats && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => { setStatusFilter('registered'); setPage(1); }}
            className={`rounded-xl bg-blue-50 px-4 py-3 text-left transition-all hover:shadow-md ${statusFilter === 'registered' ? 'ring-2 ring-blue-400' : ''}`}
          >
            <p className="text-2xl font-bold text-blue-600">{stats.registered}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">Зареєстровано</p>
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('first_order'); setPage(1); }}
            className={`rounded-xl bg-violet-50 px-4 py-3 text-left transition-all hover:shadow-md ${statusFilter === 'first_order' ? 'ring-2 ring-violet-400' : ''}`}
          >
            <p className="text-2xl font-bold text-violet-600">{stats.firstOrder}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">Перше замовлення</p>
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('bonus_granted'); setPage(1); }}
            className={`rounded-xl bg-emerald-50 px-4 py-3 text-left transition-all hover:shadow-md ${statusFilter === 'bonus_granted' ? 'ring-2 ring-emerald-400' : ''}`}
          >
            <p className="text-2xl font-bold text-emerald-600">{stats.bonusGranted}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">Бонус нараховано</p>
          </button>
          <div className="rounded-xl bg-amber-50 px-4 py-3">
            <p className="text-2xl font-bold text-amber-600">{formatPrice(stats.bonusPaid)}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">Сума виплат</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <AdminTableSkeleton rows={8} columns={7} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg-secondary)]">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Реферер</th>
                  <th className="px-4 py-2 text-left font-medium">Запрошений</th>
                  <th className="px-4 py-2 text-left font-medium">Код</th>
                  <th className="px-4 py-2 text-left font-medium">Статус</th>
                  <th className="px-4 py-2 text-right font-medium">Бонус</th>
                  <th className="px-4 py-2 text-left font-medium">Дата</th>
                  <th className="px-4 py-2 text-right font-medium">Дії</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-secondary)]">
                    <td className="px-4 py-2 text-xs">{item.referrer.fullName || item.referrer.email}</td>
                    <td className="px-4 py-2 text-xs">{item.referred.fullName || item.referred.email}</td>
                    <td className="px-4 py-2 text-xs font-mono">{item.referralCode}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.status === 'bonus_granted' ? 'bg-green-100 text-green-700' :
                        item.status === 'first_order' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-xs">
                      {item.bonusValue ? `${Number(item.bonusValue).toFixed(0)} грн` : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">{new Date(item.createdAt).toLocaleDateString('uk-UA')}</td>
                    <td className="px-4 py-2 text-right">
                      {item.status !== 'bonus_granted' && (
                        <button
                          onClick={() => {
                            setBonusModal({ id: item.id, name: item.referrer.fullName || item.referrer.email });
                            setBonusValue('');
                          }}
                          className="text-xs text-[var(--color-primary)] hover:underline"
                        >
                          Нарахувати бонус
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3 text-[var(--color-text-secondary)]">
                        <span className="text-3xl" aria-hidden="true">🔗</span>
                        <p className="text-sm font-medium">
                          {statusFilter ? 'Рефералів з цим статусом не знайдено' : 'Рефералів ще немає'}
                        </p>
                        {statusFilter ? (
                          <button
                            onClick={() => { setStatusFilter(''); setPage(1); }}
                            className="text-xs text-[var(--color-primary)] hover:underline"
                          >
                            Скинути фільтр
                          </button>
                        ) : (
                          <p className="max-w-md text-xs">
                            Реферали з&apos;являться, коли клієнти запросять друзів через свій реферальний код
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {total > 20 && (
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Назад</Button>
              <span className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">Сторінка {page} з {Math.ceil(total / 20)}</span>
              <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={items.length < 20}>Далі</Button>
            </div>
          )}
        </>
      )}

      {/* Bonus modal */}
      <Modal
        isOpen={!!bonusModal}
        onClose={() => setBonusModal(null)}
        title="Нарахувати бонус"
        size="sm"
      >
        {bonusModal && (
          <div className="space-y-4 p-4">
            <p className="text-sm">
              Нарахувати бонус для <strong>{bonusModal.name}</strong>
            </p>
            <Input
              label="Сума бонусу (грн)"
              type="number"
              value={bonusValue}
              onChange={(e) => setBonusValue(e.target.value)}
              placeholder="100"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBonusModal(null)}>
                Скасувати
              </Button>
              <Button onClick={handleGrantBonus} isLoading={isGranting} disabled={!bonusValue}>
                Нарахувати
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
