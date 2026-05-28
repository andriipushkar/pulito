'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('admin.warehousesPage');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', city: '' });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  // Derive isLoading from request/completion tokens to avoid synchronous setState in effect.
  const [reloadToken, setReloadToken] = useState(0);
  const [completedToken, setCompletedToken] = useState(-1);
  const isLoading = completedToken !== reloadToken;
  const loadWarehouses = () => setReloadToken((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<Warehouse[]>('/api/v1/admin/warehouses')
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setWarehouses(res.data);
      })
      .finally(() => {
        if (!cancelled) setCompletedToken(reloadToken);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error(t('validateNameCode'));
      return;
    }
    const res = await apiClient.post('/api/v1/admin/warehouses', form);
    if (res.success) {
      toast.success(t('createdToast'));
      setShowForm(false);
      setForm({ name: '', code: '', city: '' });
      loadWarehouses();
    } else {
      toast.error(res.error || t('createError'));
    }
  };

  const setDefault = async (id: number) => {
    const res = await apiClient.patch(`/api/v1/admin/warehouses/${id}`, { isDefault: true });
    if (res.success) toast.success(t('defaultChanged'));
    else toast.error(res.error || t('errorGeneric'));
    loadWarehouses();
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/warehouses/${id}`);
    if (res.success) toast.success(t('deletedToast'));
    else toast.error(res.error || t('deleteError'));
    loadWarehouses();
  };

  if (isLoading) {
    return <AdminTableSkeleton rows={4} columns={5} />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? t('cancel') : t('addWarehouse')}
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="mb-3 text-sm font-semibold">{t('newWarehouse')}</p>
          <div className="flex flex-wrap gap-3">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('namePlaceholder')}
              className="w-48"
            />
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder={t('codePlaceholder')}
              className="w-40"
            />
            <Input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder={t('cityPlaceholder')}
              className="w-40"
            />
            <Button onClick={handleCreate}>{t('create')}</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <th className="px-4 py-3 text-left font-medium">{t('colName')}</th>
              <th className="px-4 py-3 text-left font-medium">{t('colCode')}</th>
              <th className="px-4 py-3 text-left font-medium">{t('colCity')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('colStock')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((wh) => (
              <tr
                key={wh.id}
                className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/warehouses/${wh.id}`}
                    className="font-medium text-[var(--color-primary)] hover:underline"
                  >
                    {wh.name}
                  </Link>
                  {wh.isDefault && (
                    <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                      {t('defaultLabel')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{wh.code}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{wh.city || '—'}</td>
                <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">
                  {wh.stockCount}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/warehouses/${wh.id}`}
                      className="text-xs text-[var(--color-primary)] hover:underline"
                    >
                      {t('details')}
                    </Link>
                    {!wh.isDefault && (
                      <button
                        onClick={() => setDefault(wh.id)}
                        className="text-xs text-[var(--color-text-secondary)] hover:underline"
                      >
                        {t('makeDefault')}
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteId(wh.id)}
                      className="text-xs text-[var(--color-danger)] hover:underline"
                    >
                      {t('delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {warehouses.length === 0 && (
              <tr>
                <td
                  colSpan={5}
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
