'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import WysiwygEditor from '@/components/admin/WysiwygEditor';
import CoverImagePicker from '@/components/admin/CoverImagePicker';

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
  titleEn: string | null;
  excerptEn: string | null;
  contentEn: string | null;
  seoTitleEn: string | null;
  seoDescriptionEn: string | null;
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
  const t = useTranslations('admin.adminBlogEditPage');
  const isNew = id === 'new';
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
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
    titleEn: '',
    excerptEn: '',
    contentEn: '',
    seoTitleEn: '',
    seoDescriptionEn: '',
    isPublished: false,
  });

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<BlogCategory[]>('/api/v1/admin/blog/categories')
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setCategories(res.data);
        else toast.error(res.error || t('loadCatsError'));
      })
      .catch(() => {
        if (!cancelled) toast.error(t('loadCatsError'));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            titleEn: d.titleEn || '',
            excerptEn: d.excerptEn || '',
            contentEn: d.contentEn || '',
            seoTitleEn: d.seoTitleEn || '',
            seoDescriptionEn: d.seoDescriptionEn || '',
            isPublished: d.isPublished,
          });
        } else {
          toast.error(res.error || t('loadPostError'));
        }
      })
      .catch(() => {
        if (!cancelled) toast.error(t('loadPostError'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isNew, t]);

  /** Generate article body + SEO via AI from the typed title (topic).
   *  Fills only empty fields so a human edit is never overwritten. Same
   *  pattern as the products/categories AI buttons; backend enforces a
   *  per-user rate limit so a stuck click can't run up an AI bill. */
  const handleAiGenerate = async () => {
    if (isGenerating) return;
    const topic = form.title.trim();
    if (topic.length < 3) {
      toast.error(t('aiNeedTopic'));
      return;
    }
    setIsGenerating(true);
    try {
      const res = await apiClient.post<{
        title: string;
        excerpt: string;
        content: string;
        seoTitle: string;
        seoDescription: string;
        tags: string[];
      }>('/api/v1/admin/blog/ai-generate', {
        topic,
        categoryId: form.categoryId ? Number(form.categoryId) : undefined,
      });
      if (res.success && res.data) {
        const d = res.data;
        setForm((prev) => ({
          ...prev,
          title: prev.title || d.title,
          excerpt: prev.excerpt || d.excerpt,
          content: prev.content || d.content,
          seoTitle: prev.seoTitle || d.seoTitle,
          seoDescription: prev.seoDescription || d.seoDescription,
          tags: prev.tags || (d.tags || []).join(', '),
        }));
        toast.success(t('aiGenerated'));
      } else {
        toast.error(res.error || t('aiError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsGenerating(false);
    }
  };

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
        // Send EN fields as empty string to allow clearing them (service treats
        // empty as null). undefined would skip the field entirely.
        titleEn: form.titleEn,
        excerptEn: form.excerptEn,
        contentEn: form.contentEn,
        seoTitleEn: form.seoTitleEn,
        seoDescriptionEn: form.seoDescriptionEn,
        categoryId: form.categoryId ? Number(form.categoryId) : undefined,
        isPublished: form.isPublished,
      };

      const res = isNew
        ? await apiClient.post('/api/v1/admin/blog', payload)
        : await apiClient.patch(`/api/v1/admin/blog/${id}`, payload);

      if (res.success) {
        toast.success(isNew ? t('createdToast') : t('savedToast'));
        if (isNew) router.push('/admin/blog');
        else setMessage({ type: 'success', text: t('saved') });
      } else {
        setMessage({ type: 'error', text: res.error || t('saveError') });
      }
    } catch {
      setMessage({ type: 'error', text: t('networkError') });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin/blog" className="text-sm text-[var(--color-primary)] hover:underline">
            {t('backArrow')}
          </Link>
          <h2 className="mt-1 text-xl font-bold">{isNew ? t('newPost') : form.title}</h2>
        </div>
        <Button onClick={handleSave} isLoading={isSaving}>
          {t('save')}
        </Button>
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
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{t('basicSection')}</h3>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAiGenerate}
              isLoading={isGenerating}
            >
              {t('generateAi')}
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('titleLabel')}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Input
              label={t('slugLabel')}
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
            <div>
              <label className="mb-1 block text-sm font-medium">{t('categoryLabel')}</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                <option value="">{t('noCategory')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label={t('tagsLabel')}
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder={t('tagsPh')}
            />
          </div>
          <div className="mt-4">
            <CoverImagePicker
              label={t('coverLabel')}
              value={form.coverImage}
              onChange={(path) => setForm({ ...form, coverImage: path })}
            />
          </div>
          <div className="mt-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                className="accent-[var(--color-primary)]"
              />
              {t('published')}
            </label>
          </div>
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">{t('excerptSection')}</h3>
          <textarea
            value={form.excerpt}
            onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            rows={3}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            placeholder={t('excerptPh')}
          />
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">{t('contentSection')}</h3>
          <WysiwygEditor
            value={form.content}
            onChange={(html) => setForm({ ...form, content: html })}
            placeholder={t('contentPh')}
          />
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">{t('seoSection')}</h3>
          <div className="space-y-4">
            <Input
              label={t('metaTitle')}
              value={form.seoTitle}
              onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
            />
            <div>
              <label className="mb-1 block text-sm font-medium">{t('metaDesc')}</label>
              <textarea
                value={form.seoDescription}
                onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
                rows={3}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <span className="rounded bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
              EN
            </span>
            {t('enSection')}
          </h3>
          <p className="mb-4 text-xs text-[var(--color-text-secondary)]">{t('enHint')}</p>
          <div className="space-y-4">
            <Input
              label={t('titleEn')}
              value={form.titleEn}
              onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
            />
            <div>
              <label className="mb-1 block text-sm font-medium">{t('excerptEn')}</label>
              <textarea
                value={form.excerptEn}
                onChange={(e) => setForm({ ...form, excerptEn: e.target.value })}
                rows={3}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t('contentEn')}</label>
              <WysiwygEditor
                value={form.contentEn}
                onChange={(html) => setForm({ ...form, contentEn: html })}
                placeholder={t('contentEnPh')}
              />
            </div>
            <Input
              label={t('metaTitleEn')}
              value={form.seoTitleEn}
              onChange={(e) => setForm({ ...form, seoTitleEn: e.target.value })}
            />
            <div>
              <label className="mb-1 block text-sm font-medium">{t('metaDescEn')}</label>
              <textarea
                value={form.seoDescriptionEn}
                onChange={(e) => setForm({ ...form, seoDescriptionEn: e.target.value })}
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
