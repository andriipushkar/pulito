'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
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
      toast.success('Категорію створено');
      setShowForm(false);
      setForm({ name: '', slug: '', nameEn: '' });
      loadCategories();
    } else {
      toast.error(res.error || 'Помилка створення');
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/blog/categories/${id}`);
    if (res.success) toast.success('Категорію видалено');
    else toast.error(res.error || 'Помилка видалення');
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
            ← Блог
          </Link>
          <h2 className="mt-1 text-xl font-bold">Категорії блогу</h2>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Скасувати' : '+ Додати категорію'}
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="flex flex-wrap gap-3">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Назва категорії"
              className="w-56"
            />
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="Slug (автоматично)"
              className="w-44"
            />
            <Input
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              placeholder="Name (EN, опційно)"
              className="w-56"
            />
            <Button onClick={handleCreate}>Створити</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <th className="px-4 py-3 text-left font-medium">Назва</th>
              <th className="px-4 py-3 text-left font-medium">Slug</th>
              <th className="px-4 py-3 text-right font-medium">Статей</th>
              <th className="px-4 py-3 text-right font-medium">Дії</th>
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
                    Видалити
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
                  Категорій немає
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
        message="Видалити категорію блогу?"
      />
    </div>
  );
}
