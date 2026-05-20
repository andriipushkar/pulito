'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';

interface VolumeDiscount {
  id: number;
  productId: number | null;
  product?: { id: number; name: string; code: string } | null;
  categoryId: number | null;
  category?: { id: number; name: string } | null;
  minQuantity: number;
  maxQuantity: number | null;
  discountPercent: number;
  discountType: string;
  isActive: boolean;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

const DISCOUNT_TYPE_OPTIONS = [
  { value: 'percentage', label: 'Відсоток (%)' },
  { value: 'fixed_amount', label: 'Фіксована сума (грн)' },
];

const initialForm = {
  productId: '',
  categoryId: '',
  minQuantity: '',
  maxQuantity: '',
  discountPercent: '',
  discountType: 'percentage',
  isActive: true,
  priority: '0',
  startsAt: '',
  endsAt: '',
  stackPersonal: false,
  stackCoupon: false,
  stackLoyalty: false,
};

export default function AdminVolumeDiscountsPage() {
  const [discounts, setDiscounts] = useState<VolumeDiscount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadDiscounts = () => {
    setIsLoading(true);
    apiClient
      .get<VolumeDiscount[]>('/api/v1/admin/volume-discounts')
      .then((res) => {
        if (res.success && res.data) setDiscounts(res.data);
        else toast.error('Не вдалося завантажити знижки');
      })
      .catch(() => toast.error('Помилка мережі'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadDiscounts(); }, []);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (d: VolumeDiscount) => {
    const stackable = (d as VolumeDiscount & { stackableWith?: string[] }).stackableWith ?? [];
    setForm({
      productId: d.productId ? String(d.productId) : '',
      categoryId: d.categoryId ? String(d.categoryId) : '',
      minQuantity: String(d.minQuantity),
      maxQuantity: d.maxQuantity ? String(d.maxQuantity) : '',
      discountPercent: String(d.discountPercent),
      discountType: d.discountType,
      isActive: d.isActive,
      priority: String(d.priority),
      startsAt: d.startsAt ? d.startsAt.slice(0, 16) : '',
      endsAt: d.endsAt ? d.endsAt.slice(0, 16) : '',
      stackPersonal: stackable.includes('personal_price'),
      stackCoupon: stackable.includes('coupon'),
      stackLoyalty: stackable.includes('loyalty'),
    });
    setEditingId(d.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const stackableWith: string[] = [];
      if (form.stackPersonal) stackableWith.push('personal_price');
      if (form.stackCoupon) stackableWith.push('coupon');
      if (form.stackLoyalty) stackableWith.push('loyalty');

      const payload = {
        productId: form.productId ? Number(form.productId) : null,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        minQuantity: Number(form.minQuantity),
        maxQuantity: form.maxQuantity ? Number(form.maxQuantity) : null,
        discountPercent: Number(form.discountPercent),
        discountType: form.discountType,
        isActive: form.isActive,
        priority: Number(form.priority),
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        stackableWith,
      };

      const res = editingId
        ? await apiClient.patch(`/api/v1/admin/volume-discounts/${editingId}`, payload)
        : await apiClient.post('/api/v1/admin/volume-discounts', payload);

      if (res.success) {
        toast.success(editingId ? 'Знижку оновлено' : 'Знижку створено');
        resetForm();
        loadDiscounts();
      } else {
        toast.error(res.error || 'Помилка збереження');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
  };

  const executeDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/volume-discounts/${id}`);
    if (res.success) {
      toast.success('Знижку видалено');
    } else {
      toast.error('Помилка видалення');
    }
    loadDiscounts();
  };

  const handleToggle = async (d: VolumeDiscount) => {
    const res = await apiClient.patch(`/api/v1/admin/volume-discounts/${d.id}`, { isActive: !d.isActive });
    if (res.success) toast.success(d.isActive ? 'Знижку вимкнено' : 'Знижку увімкнено');
    else toast.error(res.error || 'Помилка оновлення');
    loadDiscounts();
  };

  const formatRange = (d: VolumeDiscount) => {
    if (d.maxQuantity) return `${d.minQuantity} — ${d.maxQuantity} шт`;
    return `від ${d.minQuantity} шт`;
  };

  const formatDiscount = (d: VolumeDiscount) => {
    if (d.discountType === 'fixed_amount') return `${d.discountPercent} грн`;
    return `${d.discountPercent}%`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('uk-UA');
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Знижки за обсяг</h2>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>Додати знижку</Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">{editingId ? 'Редагувати' : 'Нова знижка'}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="ID товару (опціонально)"
              type="number"
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
              placeholder="Для конкретного товару"
            />
            <Input
              label="ID категорії (опціонально)"
              type="number"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              placeholder="Для категорії"
            />
            <Input
              label="Мін. кількість *"
              type="number"
              value={form.minQuantity}
              onChange={(e) => setForm({ ...form, minQuantity: e.target.value })}
              placeholder="10"
            />
            <Input
              label="Макс. кількість"
              type="number"
              value={form.maxQuantity}
              onChange={(e) => setForm({ ...form, maxQuantity: e.target.value })}
              placeholder="Без обмеження"
            />
            <Input
              label="Знижка *"
              type="number"
              value={form.discountPercent}
              onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
              placeholder="5"
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Тип знижки</label>
              <Select
                options={DISCOUNT_TYPE_OPTIONS}
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value })}
              />
            </div>
            <Input
              label="Пріоритет"
              type="number"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              placeholder="0"
            />
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="accent-[var(--color-primary)]" />
                Активна
              </label>
            </div>
            <Input
              label="Початок дії"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
            <Input
              label="Кінець дії"
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
          </div>

          {/* Stacking — порожній набір означає «не комбінується» */}
          <div className="mt-4 rounded-md border border-[var(--color-border)] p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
              Поєднання з іншими знижками
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.stackPersonal}
                  onChange={(e) => setForm({ ...form, stackPersonal: e.target.checked })}
                  className="accent-[var(--color-primary)]"
                />
                Персональна ціна
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.stackCoupon}
                  onChange={(e) => setForm({ ...form, stackCoupon: e.target.checked })}
                  className="accent-[var(--color-primary)]"
                />
                Промокод
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.stackLoyalty}
                  onChange={(e) => setForm({ ...form, stackLoyalty: e.target.checked })}
                  className="accent-[var(--color-primary)]"
                />
                Бали лояльності
              </label>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} isLoading={isSaving} disabled={!form.minQuantity || !form.discountPercent}>
              {editingId ? 'Зберегти' : 'Створити'}
            </Button>
            <Button variant="outline" onClick={resetForm}>Скасувати</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <AdminTableSkeleton rows={5} columns={7} />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <th className="px-4 py-3 text-left font-medium">Товар / Категорія</th>
                <th className="px-4 py-3 text-left font-medium">Діапазон кількості</th>
                <th className="px-4 py-3 text-right font-medium">Знижка</th>
                <th className="px-4 py-3 text-center font-medium">Пріоритет</th>
                <th className="px-4 py-3 text-left font-medium">Дати</th>
                <th className="px-4 py-3 text-center font-medium">Статус</th>
                <th className="px-4 py-3 text-right font-medium">Дії</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <tr key={d.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]">
                  <td className="px-4 py-3">
                    {d.product
                      ? `${d.product.name} (${d.product.code})`
                      : d.category
                        ? `Категорія: ${d.category.name}`
                        : '—'}
                  </td>
                  <td className="px-4 py-3">{formatRange(d)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatDiscount(d)}</td>
                  <td className="px-4 py-3 text-center">{d.priority}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {formatDate(d.startsAt)} — {formatDate(d.endsAt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggle(d)} className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {d.isActive ? 'Активна' : 'Вимкнена'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleEdit(d)} className="mr-2 text-xs text-[var(--color-primary)] hover:underline">Редагувати</button>
                    <button onClick={() => handleDelete(d.id)} className="text-xs text-[var(--color-danger)] hover:underline">Видалити</button>
                  </td>
                </tr>
              ))}
              {discounts.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">Знижок за обсяг немає</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        variant="danger"
        message="Видалити цю знижку?"
      />
    </div>
  );
}
