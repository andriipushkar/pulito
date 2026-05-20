'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
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
      toast.error('Назва обовʼязкова');
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
      toast.success(editingId === 'new' ? 'Категорію створено' : 'Збережено');
      setEditingId(null);
      load();
    } else {
      toast.error(res.error || 'Помилка');
    }
  };

  const remove = async (c: FaqCategory) => {
    if (
      !window.confirm(
        `Видалити категорію "${c.name}"? Питання, що належали до неї, лишаться, але втратять прив'язку.`,
      )
    )
      return;
    const res = await apiClient.delete(`/api/v1/admin/faq-categories/${c.id}`);
    if (res.success) {
      toast.success('Видалено');
      load();
    } else {
      toast.error(res.error || 'Помилка');
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/faq" className="text-sm text-[var(--color-primary)] hover:underline">
            ← До FAQ
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Категорії FAQ</h1>
        </div>
        <Button onClick={startCreate}>+ Нова категорія</Button>
      </div>

      {isLoading && <p className="text-sm text-[var(--color-text-secondary)]">Завантаження…</p>}

      {!isLoading && cats.length === 0 && editingId === null && (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Категорій ще немає. Створи першу, щоб структурувати FAQ.
          </p>
        </div>
      )}

      {editingId !== null && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-primary)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">
            {editingId === 'new' ? 'Нова категорія' : `Категорія #${editingId}`}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Назва"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Доставка"
            />
            <Input
              label="Slug (auto)"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="dostavka"
            />
            <Input
              label="Опис"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Питання про доставку Новою Поштою"
            />
            <Input
              label="Порядок"
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
            Опубліковано
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
              Скасувати
            </Button>
            <Button size="sm" onClick={save}>
              Зберегти
            </Button>
          </div>
        </div>
      )}

      {cats.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <tr>
                <th className="px-4 py-3 text-left">Назва</th>
                <th className="px-4 py-3 text-left">Slug</th>
                <th className="px-4 py-3 text-center">Питань</th>
                <th className="px-4 py-3 text-center">Опубл.</th>
                <th className="px-4 py-3 text-center">Порядок</th>
                <th className="px-4 py-3 text-right">Дії</th>
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
                      {c.isPublished ? 'Так' : 'Ні'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">{c.sortOrder}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                        Редагувати
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => remove(c)}>
                        Видалити
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
