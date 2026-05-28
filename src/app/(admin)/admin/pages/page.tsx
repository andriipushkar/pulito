'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';

interface AdminPage {
  id: number;
  title: string;
  slug: string;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPagesPage() {
  const router = useRouter();
  const t = useTranslations('admin.adminPagesPage');
  const [pages, setPages] = useState<AdminPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', slug: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AdminPage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(() => {
    setIsLoading(true);
    apiClient
      .get<AdminPage[]>('/api/v1/admin/pages')
      .then((res) => {
        if (res.success && res.data) setPages(res.data);
        else toast.error(t('loadError'));
      })
      .catch(() => toast.error(t('networkError')))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    const title = createForm.title.trim();
    if (title.length < 2) {
      toast.error(t('validateTitle'));
      return;
    }
    setIsCreating(true);
    try {
      const res = await apiClient.post<AdminPage>('/api/v1/admin/pages', {
        title,
        content: t('newPageContent'),
        ...(createForm.slug.trim() ? { slug: createForm.slug.trim() } : {}),
      });
      if (res.success && res.data) {
        toast.success(t('createdToast'));
        router.push(`/admin/pages/${res.data.id}`);
      } else {
        toast.error(res.error || t('createError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setIsDeleting(true);
    try {
      const res = await apiClient.delete(`/api/v1/admin/pages/${id}`);
      if (res.success) {
        toast.success(t('deletedToast'));
        setConfirmDelete(null);
        load();
      } else {
        toast.error(res.error || t('deleteError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTogglePublish = async (p: AdminPage) => {
    const res = await apiClient.put(`/api/v1/admin/pages/${p.id}`, {
      isPublished: !p.isPublished,
    });
    if (res.success) {
      toast.success(p.isPublished ? t('hiddenToast') : t('publishedToast'));
      load();
    } else {
      toast.error(res.error || t('errorGeneric'));
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const filtered = search
    ? pages.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.slug.toLowerCase().includes(search.toLowerCase()),
      )
    : pages;

  if (isLoading) {
    return <AdminTableSkeleton rows={5} columns={5} />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">
          {t('title')}{' '}
          <span className="text-base font-normal text-[var(--color-text-secondary)]">
            ({pages.length})
          </span>
        </h2>
        <div className="flex gap-2">
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <Button onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? t('cancel') : t('createBtn')}
          </Button>
        </div>
      </div>

      {showCreate && (
        <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="mb-3 text-sm font-semibold">{t('newPage')}</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">{t('titleLabel')}</label>
              <Input
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                placeholder={t('titlePh')}
                className="w-64"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{t('slugLabel')}</label>
              <Input
                value={createForm.slug}
                onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                placeholder={t('slugPh')}
                className="w-48"
              />
            </div>
            <Button onClick={handleCreate} isLoading={isCreating}>
              {t('createAndEdit')}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <th className="px-4 py-3 text-left font-medium">{t('colTitle')}</th>
              <th className="px-4 py-3 text-left font-medium">{t('colSlug')}</th>
              <th className="px-4 py-3 text-center font-medium">{t('colStatus')}</th>
              <th className="px-4 py-3 text-left font-medium">{t('colUpdated')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr
                key={p.id}
                className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]"
              >
                <td className="px-4 py-3 font-medium">{p.title}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">/{p.slug}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleTogglePublish(p)}
                    className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                      p.isPublished
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                    title={t('togglePublishTitle')}
                  >
                    {p.isPublished ? t('statusPublished') : t('statusDraft')}
                  </button>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {formatDate(p.updatedAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    {p.isPublished && (
                      <a
                        href={`/pages/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:underline"
                        title={t('viewTitle')}
                      >
                        {t('view')}
                      </a>
                    )}
                    <Link
                      href={`/admin/pages/${p.id}`}
                      className="text-xs text-[var(--color-primary)] hover:underline"
                    >
                      {t('edit')}
                    </Link>
                    <button
                      onClick={() => setConfirmDelete(p)}
                      className="text-xs text-[var(--color-danger)] hover:underline"
                    >
                      {t('delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-[var(--color-text-secondary)]">
                    <span className="text-3xl" aria-hidden="true">
                      📄
                    </span>
                    <p className="text-sm font-medium">
                      {search ? t('emptySearch') : t('emptyAll')}
                    </p>
                    {search ? (
                      <button
                        onClick={() => setSearch('')}
                        className="text-xs text-[var(--color-primary)] hover:underline"
                      >
                        {t('resetSearch')}
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowCreate(true)}
                        className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-dark)]"
                      >
                        {t('createFirst')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete !== null}
        onClose={() => !isDeleting && setConfirmDelete(null)}
        onConfirm={handleDelete}
        variant="danger"
        title={t('deleteTitle')}
        message={confirmDelete ? t('deleteMsg', { title: confirmDelete.title }) : ''}
        confirmText={t('confirmDelete')}
        isLoading={isDeleting}
      />
    </div>
  );
}
