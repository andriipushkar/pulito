'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import WysiwygEditor from '@/components/admin/WysiwygEditor';
import PreviewPanel from '@/components/admin/PreviewPanel';
import { sanitizeHtml } from '@/utils/sanitize';

interface StaticPage {
  id: number;
  title: string;
  slug: string;
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
  titleEn: string | null;
  contentEn: string | null;
  seoTitleEn: string | null;
  seoDescriptionEn: string | null;
  isPublished: boolean;
  sortOrder: number;
  parentId: number | null;
}

export default function AdminPageEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('admin.adminPageEditPage');
  const [page, setPage] = useState<StaticPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    content: '',
    seoTitle: '',
    seoDescription: '',
    titleEn: '',
    contentEn: '',
    seoTitleEn: '',
    seoDescriptionEn: '',
    isPublished: false,
    sortOrder: 0,
    parentId: '' as string,
  });
  const [allPages, setAllPages] = useState<
    Array<{ id: number; title: string; parentId: number | null }>
  >([]);

  useEffect(() => {
    apiClient
      .get<StaticPage>(`/api/v1/admin/pages/${id}`)
      .then((res) => {
        if (res.success && res.data) {
          setPage(res.data);
          setForm({
            title: res.data.title,
            slug: res.data.slug,
            content: res.data.content || '',
            seoTitle: res.data.seoTitle || '',
            seoDescription: res.data.seoDescription || '',
            titleEn: res.data.titleEn || '',
            contentEn: res.data.contentEn || '',
            seoTitleEn: res.data.seoTitleEn || '',
            seoDescriptionEn: res.data.seoDescriptionEn || '',
            isPublished: res.data.isPublished,
            sortOrder: res.data.sortOrder,
            parentId: res.data.parentId ? String(res.data.parentId) : '',
          });
        }
      })
      .finally(() => setIsLoading(false));

    // Load all root pages as parent candidates. We only allow one level of
    // nesting, so any page that itself has a parentId is not a valid parent.
    apiClient
      .get<typeof allPages>('/api/v1/admin/pages')
      .then((res) => {
        if (res.success && res.data) {
          setAllPages(res.data.filter((p) => p.id !== Number(id) && p.parentId === null));
        }
      })
      .catch(() => {});
  }, [id]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await apiClient.put(`/api/v1/admin/pages/${id}`, {
        ...form,
        parentId: form.parentId === '' ? null : Number(form.parentId),
      });
      if (res.success) {
        setMessage({ type: 'success', text: t('saved') });
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

  if (!page) {
    return (
      <div className="text-center">
        <p className="text-[var(--color-text-secondary)]">{t('notFound')}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/pages')}>
          {t('backToList')}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin/pages" className="text-sm text-[var(--color-primary)] hover:underline">
            {t('backArrow')}
          </Link>
          <h2 className="mt-1 text-xl font-bold">{page.title}</h2>
        </div>
        <Button onClick={handleSave} isLoading={isSaving}>
          {t('save')}
        </Button>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-[var(--radius)] p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-[var(--color-danger)]'}`}
        >
          {message.text}
        </div>
      )}

      <PreviewPanel
        title={form.title}
        seoTitle={form.seoTitle || form.title}
        seoDescription={form.seoDescription}
        seoSlug={form.slug}
        preview={
          <article className="prose prose-sm max-w-none">
            <h1>{form.title || t('noTitle')}</h1>
            {form.content ? (
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(form.content) }} />
            ) : (
              <p className="italic text-[var(--color-text-secondary)]">{t('emptyContent')}</p>
            )}
          </article>
        }
      >
        <div className="space-y-6">
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
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
            </div>
            <div className="mt-4 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                  className="accent-[var(--color-primary)]"
                />
                {t('published')}
              </label>
              <Input
                label={t('orderLabel')}
                type="number"
                value={String(form.sortOrder)}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                className="w-24"
              />
              <div>
                <label className="mb-1 block text-sm font-medium">{t('parentLabel')}</label>
                <select
                  value={form.parentId}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                  className="h-10 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
                >
                  <option value="">{t('noParent')}</option>
                  {allPages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <p className="mt-0.5 text-[10px] text-[var(--color-text-secondary)]">
                  {t('parentHint')}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <h3 className="mb-3 text-sm font-semibold">{t('content')}</h3>
            <WysiwygEditor
              value={form.content}
              onChange={(html) => setForm({ ...form, content: html })}
              placeholder={t('contentPh')}
            />
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <h3 className="mb-3 text-sm font-semibold">{t('seo')}</h3>
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
            <div className="space-y-4">
              <Input
                label={t('titleEn')}
                value={form.titleEn}
                onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
              />
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
      </PreviewPanel>
    </div>
  );
}
