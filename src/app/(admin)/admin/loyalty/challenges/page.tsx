'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
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

export default function AdminLoyaltyChallengesPage() {
  const t = useTranslations('admin.loyaltyChallengesPage');
  const CHALLENGE_TYPES = [
    { value: 'orders_count', label: t('typeOrdersCount') },
    { value: 'total_spent', label: t('typeTotalSpent') },
    { value: 'referrals', label: t('typeReferrals') },
    { value: 'reviews', label: t('typeReviews') },
    { value: 'streak', label: t('typeStreak') },
  ];
  const [challenges, setChallenges] = useState<Challenge[]>([]);
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
  // Derive isLoading from request/completion tokens to avoid synchronous setState in effect.
  const [reloadToken, setReloadToken] = useState(0);
  const [completedToken, setCompletedToken] = useState(-1);
  const isLoading = completedToken !== reloadToken;
  const loadChallenges = () => setReloadToken((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<Challenge[]>('/api/v1/admin/loyalty/challenges')
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setChallenges(res.data);
      })
      .finally(() => {
        if (!cancelled) setCompletedToken(reloadToken);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.target || !form.reward) {
      toast.error(t('validateError'));
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
      toast.success(t('createdToast'));
      setShowForm(false);
      setForm({
        name: '',
        description: '',
        type: 'orders_count',
        target: '',
        reward: '',
        startDate: '',
        endDate: '',
      });
      loadChallenges();
    } else {
      toast.error(res.error || t('createError'));
    }
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    const res = await apiClient.patch(`/api/v1/admin/loyalty/challenges/${id}`, {
      isActive: !isActive,
    });
    if (res.success) toast.success(isActive ? t('disabledToast') : t('enabledToast'));
    else toast.error(res.error || t('errorGeneric'));
    loadChallenges();
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/loyalty/challenges/${id}`);
    if (res.success) toast.success(t('deletedToast'));
    else toast.error(res.error || t('deleteError'));
    loadChallenges();
  };

  const getTypeLabel = (type: string) =>
    CHALLENGE_TYPES.find((t) => t.value === type)?.label || type;

  if (isLoading) {
    return <AdminTableSkeleton rows={5} columns={7} />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? t('cancel') : t('createButton')}
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="mb-3 text-sm font-semibold">{t('newSection')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('nameLabel')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <div>
              <label className="mb-1 block text-sm font-medium">{t('typeLabel')}</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                {CHALLENGE_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label={t('targetLabel')}
              type="number"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              placeholder={t('targetPlaceholder')}
            />
            <Input
              label={t('rewardLabel')}
              type="number"
              value={form.reward}
              onChange={(e) => setForm({ ...form, reward: e.target.value })}
              placeholder={t('rewardPlaceholder')}
            />
            <Input
              label={t('startDateLabel')}
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
            <Input
              label={t('endDateLabel')}
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">{t('descriptionLabel')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              placeholder={t('descriptionPlaceholder')}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleCreate}>{t('create')}</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <th className="px-4 py-3 text-left font-medium">{t('colName')}</th>
              <th className="px-4 py-3 text-left font-medium">{t('colType')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('colTarget')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('colReward')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('colParticipants')}</th>
              <th className="px-4 py-3 text-center font-medium">{t('colStatus')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {challenges.map((ch) => (
              <tr
                key={ch.id}
                className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]"
              >
                <td className="px-4 py-3">
                  <div>
                    <span className="font-medium">{ch.name}</span>
                    {ch.startDate && ch.endDate && (
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {new Date(ch.startDate).toLocaleDateString('uk-UA')} —{' '}
                        {new Date(ch.endDate).toLocaleDateString('uk-UA')}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {getTypeLabel(ch.type)}
                </td>
                <td className="px-4 py-3 text-right">{ch.target}</td>
                <td className="px-4 py-3 text-right">
                  {ch.reward} {t('rewardSuffix')}
                </td>
                <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">
                  {ch.participants}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(ch.id, ch.isActive)}
                    className={`rounded-full px-2 py-0.5 text-xs ${ch.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {ch.isActive ? t('statusActive') : t('statusInactive')}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setDeleteId(ch.id)}
                    className="text-xs text-[var(--color-danger)] hover:underline"
                  >
                    {t('delete')}
                  </button>
                </td>
              </tr>
            ))}
            {challenges.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-[var(--color-text-secondary)]"
                >
                  {t('empty')}
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
        message={t('confirmDelete')}
      />
    </div>
  );
}
