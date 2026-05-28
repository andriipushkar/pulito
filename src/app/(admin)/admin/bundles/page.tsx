'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';

interface Bundle {
  id: number;
  name: string;
  bundleType: 'curated' | 'custom';
  items?: { id: number }[];
  discountPercent: number | string;
  isActive: boolean;
  createdAt: string;
}

type SortKey = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'discount_desc' | 'discount_asc';

export default function AdminBundlesPage() {
  const t = useTranslations('admin.adminBundlesPage');
  const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: 'newest', label: t('sortNewest') },
    { value: 'oldest', label: t('sortOldest') },
    { value: 'name_asc', label: t('sortNameAsc') },
    { value: 'name_desc', label: t('sortNameDesc') },
    { value: 'discount_desc', label: t('sortDiscountDesc') },
    { value: 'discount_asc', label: t('sortDiscountAsc') },
  ];
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  // Derive isLoading from request/completion tokens to avoid synchronous setState in effect.
  const [reloadToken, setReloadToken] = useState(0);
  const [completedToken, setCompletedToken] = useState(-1);
  const isLoading = completedToken !== reloadToken;
  const loadBundles = () => setReloadToken((n) => n + 1);

  const deleteTarget = bundles.find((b) => b.id === deleteId) || null;

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<Bundle[]>('/api/v1/admin/bundles')
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setBundles(res.data);
      })
      .finally(() => {
        if (!cancelled) setCompletedToken(reloadToken);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const toggleActive = async (id: number, isActive: boolean) => {
    try {
      const res = await apiClient.patch(`/api/v1/admin/bundles/${id}`, { isActive: !isActive });
      if (res.success) toast.success(isActive ? t('disabledToast') : t('enabledToast'));
      else toast.error(res.error || t('errorGeneric'));
    } catch {
      toast.error(t('networkError'));
    } finally {
      loadBundles();
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      const res = await apiClient.delete(`/api/v1/admin/bundles/${id}`);
      if (res.success) toast.success(t('deletedToast'));
      else toast.error(res.error || t('deleteError'));
    } catch {
      toast.error(t('networkError'));
    } finally {
      loadBundles();
    }
  };

  const filteredBundles = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? bundles.filter((b) => b.name.toLowerCase().includes(q)) : bundles;
    const sorted = [...filtered];
    switch (sort) {
      case 'oldest':
        sorted.sort((a, b) => a.id - b.id);
        break;
      case 'name_asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
        break;
      case 'name_desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name, 'uk'));
        break;
      case 'discount_desc':
        sorted.sort((a, b) => Number(b.discountPercent) - Number(a.discountPercent));
        break;
      case 'discount_asc':
        sorted.sort((a, b) => Number(a.discountPercent) - Number(b.discountPercent));
        break;
      case 'newest':
      default:
        sorted.sort((a, b) => b.id - a.id);
    }
    return sorted;
  }, [bundles, search, sort]);

  if (isLoading) {
    return <AdminTableSkeleton rows={5} columns={6} />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">
          {t('title')}{' '}
          <span className="text-base font-normal text-[var(--color-text-secondary)]">
            ({bundles.length})
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <Select
            options={SORT_OPTIONS}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="w-44"
          />
          <Link href="/admin/bundles/new">
            <Button>{t('create')}</Button>
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <th className="px-4 py-3 text-left font-medium">{t('colName')}</th>
              <th className="px-4 py-3 text-left font-medium">{t('colType')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('colItems')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('colDiscount')}</th>
              <th className="px-4 py-3 text-center font-medium">{t('colStatus')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredBundles.map((b) => (
              <tr
                key={b.id}
                className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/bundles/${b.id}`}
                    className="font-medium text-[var(--color-primary)] hover:underline"
                  >
                    {b.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {b.bundleType === 'curated' ? t('typeCurated') : t('typeCustom')}
                </td>
                <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">
                  {b.items?.length ?? 0}
                </td>
                <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">
                  {Number(b.discountPercent)}%
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(b.id, b.isActive)}
                    className={`rounded-full px-2 py-0.5 text-xs ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {b.isActive ? t('statusActive') : t('statusInactive')}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/bundles/${b.id}`}
                      className="text-xs text-[var(--color-primary)] hover:underline"
                    >
                      {t('edit')}
                    </Link>
                    <button
                      onClick={() => setDeleteId(b.id)}
                      className="text-xs text-[var(--color-danger)] hover:underline"
                    >
                      {t('delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredBundles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-[var(--color-text-secondary)]">
                    <span className="text-3xl" aria-hidden="true">
                      📦
                    </span>
                    {search ? (
                      <>
                        <p className="text-sm font-medium">{t('emptySearch')}</p>
                        <button
                          onClick={() => setSearch('')}
                          className="text-xs text-[var(--color-primary)] hover:underline"
                        >
                          {t('resetSearch')}
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">{t('emptyAll')}</p>
                        <p className="max-w-md text-xs">{t('emptyHint')}</p>
                        <Link
                          href="/admin/bundles/new"
                          className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-dark)]"
                        >
                          {t('createFirst')}
                        </Link>
                      </>
                    )}
                  </div>
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
        title={t('deleteTitle')}
        message={deleteTarget ? t('deleteMsg', { name: deleteTarget.name }) : t('deleteMsgGeneric')}
        confirmText={t('confirmDelete')}
      />
    </div>
  );
}
