'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';

interface Bundle {
  id: number;
  name: string;
  type: 'curated' | 'custom';
  itemsCount: number;
  discount: number;
  isActive: boolean;
  createdAt: string;
}

export default function AdminBundlesPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadBundles = () => {
    setIsLoading(true);
    apiClient
      .get<Bundle[]>('/api/v1/admin/bundles')
      .then((res) => {
        if (res.success && res.data) setBundles(res.data);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadBundles(); }, []);

  const toggleActive = async (id: number, isActive: boolean) => {
    const res = await apiClient.patch(`/api/v1/admin/bundles/${id}`, { isActive: !isActive });
    if (res.success) toast.success(isActive ? 'Набір вимкнено' : 'Набір увімкнено');
    else toast.error(res.error || 'Помилка');
    loadBundles();
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/bundles/${id}`);
    if (res.success) toast.success('Набір видалено');
    else toast.error(res.error || 'Помилка видалення');
    loadBundles();
  };

  if (isLoading) {
    return <AdminTableSkeleton rows={5} columns={6} />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Набори товарів</h2>
        <Link href="/admin/bundles/new">
          <Button>+ Створити набір</Button>
        </Link>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <th className="px-4 py-3 text-left font-medium">Назва</th>
              <th className="px-4 py-3 text-left font-medium">Тип</th>
              <th className="px-4 py-3 text-right font-medium">Товарів</th>
              <th className="px-4 py-3 text-right font-medium">Знижка</th>
              <th className="px-4 py-3 text-center font-medium">Статус</th>
              <th className="px-4 py-3 text-right font-medium">Дії</th>
            </tr>
          </thead>
          <tbody>
            {bundles.map((b) => (
              <tr key={b.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]">
                <td className="px-4 py-3">
                  <Link href={`/admin/bundles/${b.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                    {b.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {b.type === 'curated' ? 'Готовий' : 'Довільний'}
                </td>
                <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">{b.itemsCount}</td>
                <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">{b.discount}%</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(b.id, b.isActive)}
                    className={`rounded-full px-2 py-0.5 text-xs ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {b.isActive ? 'Активний' : 'Вимкнено'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/admin/bundles/${b.id}`} className="text-xs text-[var(--color-primary)] hover:underline">
                      Редагувати
                    </Link>
                    <button onClick={() => setDeleteId(b.id)} className="text-xs text-[var(--color-danger)] hover:underline">
                      Видалити
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {bundles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                  Наборів немає
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
        message="Видалити набір?"
      />
    </div>
  );
}
