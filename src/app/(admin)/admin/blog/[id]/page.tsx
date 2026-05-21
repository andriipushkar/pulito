'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import WysiwygEditor from '@/components/admin/WysiwygEditor';

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  categoryId: number | null;
  category: { id: number; name: string; slug: string } | null;
  tags: string[];
  coverImage: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
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
    categoryId: '' as string, // store as string for <select>, convert before send
    tags: '',
    coverImage: '',
    seoTitle: '',
    seoDescription: '',
    isPublished: false,
  });

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<BlogCategory[]>('/api/v1/admin/blog/categories')
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setCategories(res.data);
        else toast.error(res.error || 'Помилка завантаження категорій');
      })
      .catch(() => {
        if (!cancelled) toast.error('Помилка завантаження категорій');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    apiClient
      .get<BlogPost>(`/api/v1/admin/blog/${id}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          const d = res.data;
          setForm({
            title: d.title,
            slug: d.slug,
            content: d.content || '',
            excerpt: d.excerpt || '',
            categoryId: d.categoryId != null ? String(d.categoryId) : '',
            tags: (d.tags || []).join(', '),
            coverImage: d.coverImage || '',
            seoTitle: d.seoTitle || '',
            seoDescription: d.seoDescription || '',
            isPublished: d.isPublished,
          });
        } else {
          toast.error(res.error || 'Не вдалося завантажити статтю');
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('Не вдалося завантажити статтю');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        slug: form.slug || undefined,
        content: form.content,
        excerpt: form.excerpt || undefined,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        coverImage: form.coverImage || undefined,
        seoTitle: form.seoTitle || undefined,
        seoDescription: form.seoDescription || undefined,
        categoryId: form.categoryId ? Number(form.categoryId) : undefined,
        isPublished: form.isPublished,
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
        <div
          role="alert"
          className={`mb-4 rounded-[var(--radius)] p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-[var(--color-danger)]'}`}
        >
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
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                <option value="">Без категорії</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
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
          <WysiwygEditor
            value={form.content}
            onChange={(html) => setForm({ ...form, content: html })}
            placeholder="Вміст статті..."
          />
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">SEO</h3>
          <div className="space-y-4">
            <Input label="Meta Title" value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
            <div>
              <label className="mb-1 block text-sm font-medium">Meta Description</label>
              <textarea
                value={form.seoDescription}
                onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
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
