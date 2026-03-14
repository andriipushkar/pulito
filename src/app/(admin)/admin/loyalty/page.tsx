'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface LoyaltyLevel {
  id?: number;
  name: string;
  minSpent: number;
  pointsMultiplier: number;
  discountPercent: number;
  sortOrder: number;
}

export default function AdminLoyaltyPage() {
  const [levels, setLevels] = useState<LoyaltyLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmSaveLevels, setConfirmSaveLevels] = useState(false);

  // Manual adjust form
  const [adjustUserId, setAdjustUserId] = useState('');
  const [adjustType, setAdjustType] = useState<'manual_add' | 'manual_deduct'>('manual_add');
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustDesc, setAdjustDesc] = useState('');

  useEffect(() => {
    apiClient
      .get<LoyaltyLevel[]>('/api/v1/admin/loyalty/settings')
      .then((res) => {
        if (res.success && res.data) {
          setLevels(
            res.data.length > 0
              ? res.data.map((l) => ({
                  ...l,
                  minSpent: Number(l.minSpent),
                  discountPercent: Number(l.discountPercent),
                }))
              : [
                  { name: 'bronze', minSpent: 0, pointsMultiplier: 1, discountPercent: 0, sortOrder: 0 },
                  { name: 'silver', minSpent: 5000, pointsMultiplier: 1.5, discountPercent: 3, sortOrder: 1 },
                  { name: 'gold', minSpent: 20000, pointsMultiplier: 2, discountPercent: 5, sortOrder: 2 },
                  { name: 'platinum', minSpent: 50000, pointsMultiplier: 3, discountPercent: 10, sortOrder: 3 },
                ]
          );
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSaveLevels = async () => {
    setConfirmSaveLevels(false);
    setIsSaving(true);
    const res = await apiClient.put('/api/v1/admin/loyalty/settings', { levels });
    setIsSaving(false);
    if (res.success) toast.success('Рівні лояльності збережено');
    else toast.error(res.error || 'Помилка збереження');
  };

  const handleAdjust = async () => {
    if (!adjustUserId || !adjustPoints || !adjustDesc) {
      toast.error('Заповніть всі поля');
      return;
    }
    const pts = parseInt(adjustPoints);
    if (isNaN(pts) || pts <= 0) {
      toast.error('Кількість балів має бути більше 0');
      return;
    }
    const res = await apiClient.post('/api/v1/admin/loyalty/adjust', {
      userId: parseInt(adjustUserId),
      type: adjustType,
      points: pts,
      description: adjustDesc,
    });
    if (res.success) {
      setAdjustUserId('');
      setAdjustPoints('');
      setAdjustDesc('');
      toast.success('Бали оновлено');
    } else {
      toast.error(res.error || 'Помилка');
    }
  };

  const updateLevel = (index: number, field: keyof LoyaltyLevel, value: string | number) => {
    setLevels((prev) =>
      prev.map((l, i) =>
        i === index ? { ...l, [field]: typeof value === 'string' && field !== 'name' ? parseFloat(value) || 0 : value } : l
      )
    );
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold">Програма лояльності</h2>

      {/* Levels configuration */}
      <div className="mb-8">
        <h3 className="mb-4 text-lg font-semibold">Рівні</h3>
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-secondary)]">
              <tr>
                <th className="px-3 py-2 text-left">Назва</th>
                <th className="px-3 py-2 text-right">Мін. витрати (₴)</th>
                <th className="px-3 py-2 text-right">Множник балів</th>
                <th className="px-3 py-2 text-right">Знижка (%)</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((level, i) => (
                <tr key={i} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2">
                    <input
                      value={level.name}
                      onChange={(e) => updateLevel(i, 'name', e.target.value)}
                      className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={level.minSpent}
                      onChange={(e) => updateLevel(i, 'minSpent', e.target.value)}
                      className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-right text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.1"
                      value={level.pointsMultiplier}
                      onChange={(e) => updateLevel(i, 'pointsMultiplier', e.target.value)}
                      className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-right text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={level.discountPercent}
                      onChange={(e) => updateLevel(i, 'discountPercent', e.target.value)}
                      className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-right text-sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={() => setConfirmSaveLevels(true)} isLoading={isSaving}>Зберегти рівні</Button>
          <Button
            onClick={() =>
              setLevels((prev) => [
                ...prev,
                { name: '', minSpent: 0, pointsMultiplier: 1, discountPercent: 0, sortOrder: prev.length },
              ])
            }
          >
            + Додати рівень
          </Button>
        </div>
      </div>

      {/* Manual points adjust */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Ручне управління балами</h3>
        <div className="grid gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 sm:grid-cols-2">
          <Input label="ID користувача" value={adjustUserId} onChange={(e) => setAdjustUserId(e.target.value)} />
          <div>
            <label className="mb-1 block text-sm font-medium">Тип</label>
            <select
              value={adjustType}
              onChange={(e) => setAdjustType(e.target.value as 'manual_add' | 'manual_deduct')}
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
            >
              <option value="manual_add">Нарахувати</option>
              <option value="manual_deduct">Списати</option>
            </select>
          </div>
          <Input label="Кількість балів" value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)} />
          <Input label="Опис" value={adjustDesc} onChange={(e) => setAdjustDesc(e.target.value)} />
        </div>
        <div className="mt-3">
          <Button onClick={handleAdjust}>Застосувати</Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmSaveLevels}
        onClose={() => setConfirmSaveLevels(false)}
        onConfirm={handleSaveLevels}
        title="Зберегти рівні лояльності"
        message="Зміни в рівнях лояльності набудуть чинності для всіх користувачів. Продовжити?"
        confirmText="Так, зберегти"
      />
    </div>
  );
}
