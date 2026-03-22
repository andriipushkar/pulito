'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';

interface Challenge {
  id: number;
  name: string;
  description: string;
  type: string;
  target: number;
  reward: number;
  participants: number;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
}

const CHALLENGE_TYPES = [
  { value: 'orders_count', label: 'Кількість замовлень' },
  { value: 'total_spent', label: 'Сума витрат' },
  { value: 'referrals', label: 'Запрошені друзі' },
  { value: 'reviews', label: 'Відгуки' },
  { value: 'streak', label: 'Серія замовлень' },
];

export default function AdminLoyaltyChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'orders_count',
    target: '',
    reward: '',
    startDate: '',
    endDate: '',
  });

  const loadChallenges = () => {
    setIsLoading(true);
    apiClient
      .get<Challenge[]>('/api/v1/admin/loyalty/challenges')
      .then((res) => {
        if (res.success && res.data) setChallenges(res.data);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadChallenges(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.target || !form.reward) {
      toast.error('Заповніть обов\'язкові поля');
      return;
    }
    const res = await apiClient.post('/api/v1/admin/loyalty/challenges', {
      name: form.name.trim(),
      description: form.description.trim(),
      type: form.type,
      target: Number(form.target),
      reward: Number(form.reward),
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    });
    if (res.success) {
      toast.success('Виклик створено');
      setShowForm(false);
      setForm({ name: '', description: '', type: 'orders_count', target: '', reward: '', startDate: '', endDate: '' });
      loadChallenges();
    } else {
      toast.error(res.error || 'Помилка створення');
    }
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    const res = await apiClient.patch(`/api/v1/admin/loyalty/challenges/${id}`, { isActive: !isActive });
    if (res.success) toast.success(isActive ? 'Виклик вимкнено' : 'Виклик увімкнено');
    else toast.error(res.error || 'Помилка');
    loadChallenges();
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/loyalty/challenges/${id}`);
    if (res.success) toast.success('Виклик видалено');
    else toast.error(res.error || 'Помилка видалення');
    loadChallenges();
  };

  const getTypeLabel = (type: string) => CHALLENGE_TYPES.find((t) => t.value === type)?.label || type;

  if (isLoading) {
    return <AdminTableSkeleton rows={5} columns={7} />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Виклики лояльності</h2>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Скасувати' : '+ Створити виклик'}</Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="mb-3 text-sm font-semibold">Новий виклик</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Назва *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div>
              <label className="mb-1 block text-sm font-medium">Тип *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                {CHALLENGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <Input label="Ціль (число) *" type="number" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="Наприклад: 10" />
            <Input label="Винагорода (бали) *" type="number" value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} placeholder="Наприклад: 500" />
            <Input label="Дата початку" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="Дата завершення" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">Опис</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              placeholder="Опис виклику..."
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleCreate}>Створити</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <th className="px-4 py-3 text-left font-medium">Назва</th>
              <th className="px-4 py-3 text-left font-medium">Тип</th>
              <th className="px-4 py-3 text-right font-medium">Ціль</th>
              <th className="px-4 py-3 text-right font-medium">Винагорода</th>
              <th className="px-4 py-3 text-right font-medium">Учасників</th>
              <th className="px-4 py-3 text-center font-medium">Статус</th>
              <th className="px-4 py-3 text-right font-medium">Дії</th>
            </tr>
          </thead>
          <tbody>
            {challenges.map((ch) => (
              <tr key={ch.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]">
                <td className="px-4 py-3">
                  <div>
                    <span className="font-medium">{ch.name}</span>
                    {ch.startDate && ch.endDate && (
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {new Date(ch.startDate).toLocaleDateString('uk-UA')} — {new Date(ch.endDate).toLocaleDateString('uk-UA')}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{getTypeLabel(ch.type)}</td>
                <td className="px-4 py-3 text-right">{ch.target}</td>
                <td className="px-4 py-3 text-right">{ch.reward} балів</td>
                <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">{ch.participants}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(ch.id, ch.isActive)}
                    className={`rounded-full px-2 py-0.5 text-xs ${ch.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {ch.isActive ? 'Активний' : 'Вимкнено'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setDeleteId(ch.id)} className="text-xs text-[var(--color-danger)] hover:underline">
                    Видалити
                  </button>
                </td>
              </tr>
            ))}
            {challenges.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                  Викликів немає
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        variant="danger"
        message="Видалити виклик?"
      />
    </div>
  );
}
