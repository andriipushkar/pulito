'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  category: string;
  tags: string[];
  coverImage: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isPublished: boolean;
}

interface BlogCategory {
  id: number;
  name: string;
  slug: string;
}

export default function AdminBlogEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    category: '',
    tags: '',
    coverImage: '',
    metaTitle: '',
    metaDescription: '',
    isPublished: false,
  });

  useEffect(() => {
    apiClient.get<BlogCategory[]>('/api/v1/admin/blog/categories').then((res) => {
      if (res.success && res.data) setCategories(res.data);
    });
  }, []);

  useEffect(() => {
    if (isNew) return;
    apiClient
      .get<BlogPost>(`/api/v1/admin/blog/${id}`)
      .then((res) => {
        if (res.success && res.data) {
          const d = res.data;
          setForm({
            title: d.title,
            slug: d.slug,
            content: d.content || '',
            excerpt: d.excerpt || '',
            category: d.category || '',
            tags: (d.tags || []).join(', '),
            coverImage: d.coverImage || '',
            metaTitle: d.metaTitle || '',
            metaDescription: d.metaDescription || '',
            isPublished: d.isPublished,
          });
        }
      })
      .finally(() => setIsLoading(false));
  }, [id, isNew]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        coverImage: form.coverImage || null,
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
      };

      const res = isNew
        ? await apiClient.post('/api/v1/admin/blog', payload)
        : await apiClient.patch(`/api/v1/admin/blog/${id}`, payload);

      if (res.success) {
        toast.success(isNew ? 'Статтю створено' : 'Збережено');
        if (isNew) router.push('/admin/blog');
        else setMessage({ type: 'success', text: 'Збережено!' });
      } else {
        setMessage({ type: 'error', text: res.error || 'Помилка збереження' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Помилка мережі' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin/blog" className="text-sm text-[var(--color-primary)] hover:underline">← Блог</Link>
          <h2 className="mt-1 text-xl font-bold">{isNew ? 'Нова стаття' : form.title}</h2>
        </div>
        <Button onClick={handleSave} isLoading={isSaving}>Зберегти</Button>
      </div>

      {message && (
        <div className={`mb-4 rounded-[var(--radius)] p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-[var(--color-danger)]'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">Основне</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Заголовок *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input label="Slug *" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            <div>
              <label className="mb-1 block text-sm font-medium">Категорія</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                <option value="">Без категорії</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </div>
            <Input label="Теги (через кому)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="тег1, тег2, тег3" />
          </div>
          <div className="mt-4">
            <Input label="URL обкладинки" value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })} placeholder="https://..." />
          </div>
          <div className="mt-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} className="accent-[var(--color-primary)]" />
              Опубліковано
            </label>
          </div>
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">Короткий опис</h3>
          <textarea
            value={form.excerpt}
            onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            rows={3}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            placeholder="Короткий опис для списку та SEO..."
          />
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">Вміст</h3>
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={15}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            placeholder="Вміст статті..."
          />
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">SEO</h3>
          <div className="space-y-4">
            <Input label="Meta Title" value={form.metaTitle} onChange={(e) => setForm({ ...form, metaTitle: e.target.value })} />
            <div>
              <label className="mb-1 block text-sm font-medium">Meta Description</label>
              <textarea
                value={form.metaDescription}
                onChange={(e) => setForm({ ...form, metaDescription: e.target.value })}
                rows={3}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
