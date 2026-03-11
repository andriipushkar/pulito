'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Check, Close } from '@/components/icons';

const BADGE_TYPES = [
  { value: 'promo', label: 'Акція' },
  { value: 'new_arrival', label: 'Новинка' },
  { value: 'hit', label: 'Хіт' },
  { value: 'eco', label: 'Еко' },
  { value: 'custom', label: 'Інший' },
];

interface Badge {
  id: number;
  productId: number;
  badgeType: string;
  customText: string | null;
  customColor: string | null;
  priority: number;
  isActive: boolean;
  product: { id: number; name: string; code: string };
}

interface EditForm {
  badgeType: string;
  customText: string;
  customColor: string;
  priority: number;
}

export default function AdminBadgesPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ productId: '', badgeType: 'promo', customText: '', customColor: '#2563eb', priority: 0 });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ badgeType: 'promo', customText: '', customColor: '#2563eb', priority: 0 });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadBadges = () => {
    apiClient.get<Badge[]>('/api/v1/admin/badges').then((res) => {
      if (res.success && res.data) setBadges(res.data);
    }).finally(() => setIsLoading(false));
  };

  useEffect(() => { loadBadges(); }, []);

  const handleCreate = async () => {
    await apiClient.post('/api/v1/admin/badges', {
      productId: Number(form.productId),
      badgeType: form.badgeType,
      customText: form.badgeType === 'custom' ? form.customText : null,
      customColor: form.customColor || null,
      priority: form.priority,
    });
    setShowForm(false);
    setForm({ productId: '', badgeType: 'promo', customText: '', customColor: '#2563eb', priority: 0 });
    loadBadges();
  };

  const startEdit = (b: Badge) => {
    setEditingId(b.id);
    setEditForm({
      badgeType: b.badgeType,
      customText: b.customText || '',
      customColor: b.customColor || '#2563eb',
      priority: b.priority,
    });
  };

  const saveEdit = async (id: number) => {
    await apiClient.put(`/api/v1/admin/badges/${id}`, {
      badgeType: editForm.badgeType,
      customText: editForm.badgeType === 'custom' ? editForm.customText : null,
      customColor: editForm.customColor,
      priority: editForm.priority,
    });
    setEditingId(null);
    loadBadges();
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    await apiClient.put(`/api/v1/admin/badges/${id}`, { isActive: !isActive });
    loadBadges();
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
  };

  const executeDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    await apiClient.delete(`/api/v1/admin/badges/${id}`);
    loadBadges();
  };

  const getBadgeLabel = (type: string) => BADGE_TYPES.find((t) => t.value === type)?.label || type;

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Бейджі товарів</h2>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Скасувати' : '+ Додати бейдж'}</Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Input label="ID товару" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} placeholder="123" />
            <div>
              <label className="mb-1 block text-sm font-medium">Тип бейджа</label>
              <select
                value={form.badgeType}
                onChange={(e) => setForm({ ...form, badgeType: e.target.value })}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                {BADGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <Input label="Пріоритет" type="number" value={String(form.priority)} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
          </div>
          {form.badgeType === 'custom' && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input label="Текст бейджа" value={form.customText} onChange={(e) => setForm({ ...form, customText: e.target.value })} />
              <div>
                <label className="mb-1 block text-sm font-medium">Колір</label>
                <input type="color" value={form.customColor} onChange={(e) => setForm({ ...form, customColor: e.target.value })} className="h-10 w-full rounded" />
              </div>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button onClick={handleCreate}>Створити</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {badges.map((b) => (
          <div key={b.id} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
            {editingId === b.id ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium">Тип</label>
                    <select
                      value={editForm.badgeType}
                      onChange={(e) => setEditForm({ ...editForm, badgeType: e.target.value })}
                      className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
                    >
                      {BADGE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Пріоритет</label>
                    <input
                      type="number"
                      value={editForm.priority}
                      onChange={(e) => setEditForm({ ...editForm, priority: Number(e.target.value) })}
                      className="w-full rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Колір</label>
                    <input type="color" value={editForm.customColor} onChange={(e) => setEditForm({ ...editForm, customColor: e.target.value })} className="h-8 w-full rounded" />
                  </div>
                </div>
                {editForm.badgeType === 'custom' && (
                  <input
                    placeholder="Текст бейджа"
                    value={editForm.customText}
                    onChange={(e) => setEditForm({ ...editForm, customText: e.target.value })}
                    className="w-full rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                  />
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingId(null)} className="rounded-[var(--radius)] border border-[var(--color-border)] p-1.5"><Close size={16} /></button>
                  <button onClick={() => saveEdit(b.id)} className="rounded-[var(--radius)] bg-[var(--color-primary)] p-1.5 text-white"><Check size={16} /></button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: b.customColor || '#2563eb' }}
                >
                  {b.customText || getBadgeLabel(b.badgeType)}
                </span>
                <span className="flex-1 text-sm">{b.product.name}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">{b.product.code}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">Пріоритет: {b.priority}</span>
                <button onClick={() => startEdit(b)} className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)]">Редагувати</button>
                <button onClick={() => toggleActive(b.id, b.isActive)} className={`rounded-full px-3 py-1 text-xs ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {b.isActive ? 'Активний' : 'Вимкнено'}
                </button>
                <button onClick={() => handleDelete(b.id)} className="text-xs text-red-500 hover:text-red-700">Видалити</button>
              </div>
            )}
          </div>
        ))}
        {badges.length === 0 && (
          <div className="py-8 text-center text-[var(--color-text-secondary)]">Бейджів немає</div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        variant="danger"
        message="Видалити бейдж?"
      />
    </div>
  );
}
