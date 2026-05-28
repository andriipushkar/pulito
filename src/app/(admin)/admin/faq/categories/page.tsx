'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface FaqCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  iconPath: string | null;
  sortOrder: number;
  isPublished: boolean;
  _count?: { items: number };
}

const EMPTY = { name: '', slug: '', description: '', sortOrder: 0, isPublished: true };

export default function FaqCategoriesAdminPage() {
  const t = useTranslations('admin.faqCategoriesPage');
  const [cats, setCats] = useState<FaqCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    setIsLoading(true);
    const res = await apiClient.get<FaqCategory[]>('/api/v1/admin/faq-categories');
    if (res.success && res.data) setCats(res.data);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startCreate = () => {
    setEditingId('new');
    setForm(EMPTY);
  };

  const startEdit = (c: FaqCategory) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      slug: c.slug,
      description: c.description ?? '',
      sortOrder: c.sortOrder,
      isPublished: c.isPublished,
    });
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(t('nameRequired'));
      return;
    }
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      isPublished: form.isPublished,
    };
    const res =
      editingId === 'new'
        ? await apiClient.post('/api/v1/admin/faq-categories', payload)
        : await apiClient.put(`/api/v1/admin/faq-categories/${editingId}`, payload);
    if (res.success) {
      toast.success(editingId === 'new' ? t('createdToast') : t('savedToast'));
      setEditingId(null);
      load();
    } else {
      toast.error(res.error || t('errorGeneric'));
    }
  };

  const remove = async (c: FaqCategory) => {
    if (!window.confirm(t('confirmDelete', { name: c.name }))) return;
    const res = await apiClient.delete(`/api/v1/admin/faq-categories/${c.id}`);
    if (res.success) {
      toast.success(t('deletedToast'));
      load();
    } else {
      toast.error(res.error || t('errorGeneric'));
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/faq" className="text-sm text-[var(--color-primary)] hover:underline">
            {t('backToFaq')}
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{t('title')}</h1>
        </div>
        <Button onClick={startCreate}>{t('newCategory')}</Button>
      </div>

      {isLoading && <p className="text-sm text-[var(--color-text-secondary)]">{t('loading')}</p>}

      {!isLoading && cats.length === 0 && editingId === null && (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">{t('empty')}</p>
        </div>
      )}

      {editingId !== null && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-primary)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">
            {editingId === 'new' ? t('newSection') : t('editingSection', { id: editingId })}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={t('nameLabel')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('namePlaceholder')}
            />
            <Input
              label={t('slugLabel')}
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder={t('slugPlaceholder')}
            />
            <Input
              label={t('descriptionLabel')}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('descriptionPlaceholder')}
            />
            <Input
              label={t('sortOrderLabel')}
              type="number"
              value={String(form.sortOrder)}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              className="w-32"
            />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
              className="accent-[var(--color-primary)]"
            />
            {t('isPublished')}
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
              {t('cancel')}
            </Button>
            <Button size="sm" onClick={save}>
              {t('save')}
            </Button>
          </div>
        </div>
      )}

      {cats.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <tr>
                <th className="px-4 py-3 text-left">{t('colName')}</th>
                <th className="px-4 py-3 text-left">{t('colSlug')}</th>
                <th className="px-4 py-3 text-center">{t('colQuestions')}</th>
                <th className="px-4 py-3 text-center">{t('colPublished')}</th>
                <th className="px-4 py-3 text-center">{t('colSort')}</th>
                <th className="px-4 py-3 text-right">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">
                    {c.slug}
                  </td>
                  <td className="px-4 py-3 text-center text-[var(--color-text-secondary)]">
                    {c._count?.items ?? 0}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        c.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c.isPublished ? t('yes') : t('no')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">{c.sortOrder}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                        {t('edit')}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => remove(c)}>
                        {t('delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
