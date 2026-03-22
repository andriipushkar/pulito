'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';

interface Warehouse {
  id: number;
  name: string;
  code: string;
  city: string;
  stockCount: number;
  isDefault: boolean;
}

export default function AdminWarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', city: '' });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadWarehouses = () => {
    setIsLoading(true);
    apiClient
      .get<Warehouse[]>('/api/v1/admin/warehouses')
      .then((res) => {
        if (res.success && res.data) setWarehouses(res.data);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadWarehouses(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error('Заповніть назву та код');
      return;
    }
    const res = await apiClient.post('/api/v1/admin/warehouses', form);
    if (res.success) {
      toast.success('Склад створено');
      setShowForm(false);
      setForm({ name: '', code: '', city: '' });
      loadWarehouses();
    } else {
      toast.error(res.error || 'Помилка створення');
    }
  };

  const setDefault = async (id: number) => {
    const res = await apiClient.patch(`/api/v1/admin/warehouses/${id}`, { isDefault: true });
    if (res.success) toast.success('Основний склад змінено');
    else toast.error(res.error || 'Помилка');
    loadWarehouses();
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/warehouses/${id}`);
    if (res.success) toast.success('Склад видалено');
    else toast.error(res.error || 'Помилка видалення');
    loadWarehouses();
  };

  if (isLoading) {
    return <AdminTableSkeleton rows={4} columns={5} />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Склади</h2>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Скасувати' : '+ Додати склад'}</Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="mb-3 text-sm font-semibold">Новий склад</p>
          <div className="flex flex-wrap gap-3">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Назва складу" className="w-48" />
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Код (наприклад, WH-01)" className="w-40" />
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Місто" className="w-40" />
            <Button onClick={handleCreate}>Створити</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <th className="px-4 py-3 text-left font-medium">Назва</th>
              <th className="px-4 py-3 text-left font-medium">Код</th>
              <th className="px-4 py-3 text-left font-medium">Місто</th>
              <th className="px-4 py-3 text-right font-medium">Позицій на складі</th>
              <th className="px-4 py-3 text-right font-medium">Дії</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((wh) => (
              <tr key={wh.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]">
                <td className="px-4 py-3">
                  <Link href={`/admin/warehouses/${wh.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                    {wh.name}
                  </Link>
                  {wh.isDefault && (
                    <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Основний</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{wh.code}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{wh.city || '—'}</td>
                <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">{wh.stockCount}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/admin/warehouses/${wh.id}`} className="text-xs text-[var(--color-primary)] hover:underline">
                      Деталі
                    </Link>
                    {!wh.isDefault && (
                      <button onClick={() => setDefault(wh.id)} className="text-xs text-[var(--color-text-secondary)] hover:underline">
                        Зробити основним
                      </button>
                    )}
                    <button onClick={() => setDeleteId(wh.id)} className="text-xs text-[var(--color-danger)] hover:underline">
                      Видалити
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {warehouses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                  Складів немає
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
        message="Видалити склад?"
      />
    </div>
  );
}
