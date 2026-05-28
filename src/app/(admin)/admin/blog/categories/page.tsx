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

interface BlogCategory {
  id: number;
  name: string;
  slug: string;
  _count?: { posts: number };
}

export default function AdminBlogCategoriesPage() {
  const t = useTranslations('admin.blogCategoriesPage');
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', nameEn: '' });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  // Derive isLoading from request/completion tokens so we never need a
  // synchronous setIsLoading(true) inside the fetch effect.
  const [reloadToken, setReloadToken] = useState(0);
  const [completedToken, setCompletedToken] = useState(-1);
  const isLoading = completedToken !== reloadToken;
  const loadCategories = () => setReloadToken((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<BlogCategory[]>('/api/v1/admin/blog/categories')
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setCategories(res.data);
      })
      .finally(() => {
        if (!cancelled) setCompletedToken(reloadToken);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    const userSlug = form.slug.trim();
    const nameEn = form.nameEn.trim();
    const payload: Record<string, unknown> = { name: form.name.trim() };
    if (userSlug) payload.slug = userSlug;
    if (nameEn) payload.nameEn = nameEn;
    const res = await apiClient.post('/api/v1/admin/blog/categories', payload);
    if (res.success) {
      toast.success(t('createdToast'));
      setShowForm(false);
      setForm({ name: '', slug: '', nameEn: '' });
      loadCategories();
    } else {
      toast.error(res.error || t('createError'));
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/blog/categories/${id}`);
    if (res.success) toast.success(t('deletedToast'));
    else toast.error(res.error || t('deleteError'));
    loadCategories();
  };

  if (isLoading) {
    return <AdminTableSkeleton rows={4} columns={3} />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin/blog" className="text-sm text-[var(--color-primary)] hover:underline">
            {t('backToBlog')}
          </Link>
          <h2 className="mt-1 text-xl font-bold">{t('title')}</h2>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? t('cancel') : t('addCategory')}
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="flex flex-wrap gap-3">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('namePlaceholder')}
              className="w-56"
            />
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder={t('slugPlaceholder')}
              className="w-44"
            />
            <Input
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              placeholder={t('nameEnPlaceholder')}
              className="w-56"
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
              <th className="px-4 py-3 text-left font-medium">{t('colSlug')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('colPosts')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr
                key={cat.id}
                className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]"
              >
                <td className="px-4 py-3 font-medium">{cat.name}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">/{cat.slug}</td>
                <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">
                  {cat._count?.posts ?? 0}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setDeleteId(cat.id)}
                    className="text-xs text-[var(--color-danger)] hover:underline"
                  >
                    {t('delete')}
                  </button>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td
                  colSpan={4}
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
