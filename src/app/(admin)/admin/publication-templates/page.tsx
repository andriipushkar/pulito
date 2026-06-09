'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';

const ALL_CHANNELS = ['telegram', 'instagram', 'facebook', 'tiktok', 'site'] as const;
type Channel = (typeof ALL_CHANNELS)[number];

interface Template {
  id: number;
  name: string;
  description: string | null;
  channels: Channel[];
  titleTemplate: string | null;
  contentTemplate: string;
  hashtagsTemplate: string | null;
  firstComment: string | null;
  isActive: boolean;
  createdAt: string;
}

interface FormState {
  name: string;
  description: string;
  channels: Channel[];
  titleTemplate: string;
  contentTemplate: string;
  hashtagsTemplate: string;
  firstComment: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  channels: ['telegram'],
  titleTemplate: '',
  contentTemplate: '',
  hashtagsTemplate: '',
  firstComment: '',
  isActive: true,
};

export default function PublicationTemplatesPage() {
  const t = useTranslations('admin.publicationTemplatesPage');
  const [items, setItems] = useState<Template[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewProductId, setPreviewProductId] = useState('');
  const [previewResult, setPreviewResult] = useState<{
    title: string;
    content: string;
    hashtags: string | null;
  } | null>(null);
  // Derive isLoading from request/completion tokens to avoid synchronous setState in effect.
  const [reloadToken, setReloadToken] = useState(0);
  const [completedToken, setCompletedToken] = useState(-1);
  const isLoading = completedToken !== reloadToken;
  const load = () => setReloadToken((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<Template[]>('/api/v1/admin/publication-templates')
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setItems(res.data);
      })
      .finally(() => {
        if (!cancelled) setCompletedToken(reloadToken);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const startEdit = (tpl: Template) => {
    setEditingId(tpl.id);
    setForm({
      name: tpl.name,
      description: tpl.description ?? '',
      channels: tpl.channels,
      titleTemplate: tpl.titleTemplate ?? '',
      contentTemplate: tpl.contentTemplate,
      hashtagsTemplate: tpl.hashtagsTemplate ?? '',
      firstComment: tpl.firstComment ?? '',
      isActive: tpl.isActive,
    });
    setShowForm(true);
  };

  const submit = async () => {
    const payload = {
      name: form.name,
      description: form.description || null,
      channels: form.channels,
      titleTemplate: form.titleTemplate || null,
      contentTemplate: form.contentTemplate,
      hashtagsTemplate: form.hashtagsTemplate || null,
      firstComment: form.firstComment || null,
      isActive: form.isActive,
    };
    const res = editingId
      ? await apiClient.put(`/api/v1/admin/publication-templates/${editingId}`, payload)
      : await apiClient.post('/api/v1/admin/publication-templates', payload);
    if (res.success) {
      toast.success(editingId ? t('savedToast') : t('createdToast'));
      setShowForm(false);
      load();
    } else {
      toast.error(res.error || t('saveError'));
    }
  };

  const remove = async (id: number) => {
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/publication-templates/${id}`);
    if (res.success) {
      toast.success(t('deletedToast'));
      load();
    } else {
      toast.error(res.error || t('deleteError'));
    }
  };

  const runPreview = async () => {
    if (!previewId) return;
    const productId = previewProductId.trim() ? Number(previewProductId) : null;
    const res = await apiClient.post<{ title: string; content: string; hashtags: string | null }>(
      `/api/v1/admin/publication-templates/${previewId}/apply`,
      { productId },
    );
    if (res.success && res.data) {
      setPreviewResult(res.data);
    } else {
      toast.error(res.error || t('previewError'));
    }
  };

  const toggleChannel = (ch: Channel) => {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter((c) => c !== ch) : [...f.channels, ch],
    }));
  };

  if (isLoading) return <AdminTableSkeleton />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{t('title')}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {t('intro')}
            <code className="rounded bg-[var(--color-bg-secondary)] px-1">
              {'{{product.name}}'}
            </code>
            ,{' '}
            <code className="rounded bg-[var(--color-bg-secondary)] px-1">
              {'{{product.price}}'}
            </code>
            ,{' '}
            <code className="rounded bg-[var(--color-bg-secondary)] px-1">{'{{product.url}}'}</code>
            ,{' '}
            <code className="rounded bg-[var(--color-bg-secondary)] px-1">
              {'{{product.discount}}'}
            </code>
          </p>
        </div>
        <Button onClick={startCreate}>{t('newTemplate')}</Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] py-12 text-center text-[var(--color-text-secondary)]">
          <span className="text-3xl" aria-hidden="true">
            📋
          </span>
          <p className="text-sm font-medium">{t('emptyTitle')}</p>
          <p className="max-w-md text-xs">{t('emptyHint')}</p>
          <button
            onClick={startCreate}
            className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-dark)]"
          >
            {t('createFirst')}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-secondary)] text-left">
              <tr>
                <th className="px-4 py-2">{t('colName')}</th>
                <th className="px-4 py-2">{t('colChannels')}</th>
                <th className="px-4 py-2">{t('colActive')}</th>
                <th className="px-4 py-2 text-right">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((tpl) => (
                <tr key={tpl.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-2">
                    <div className="font-medium">{tpl.name}</div>
                    {tpl.description ? (
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {tpl.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <div className="flex flex-wrap gap-1">
                      {tpl.channels.map((ch) => (
                        <span
                          key={ch}
                          className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] font-medium"
                        >
                          {ch}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        tpl.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {tpl.isActive ? t('statusActive') : t('statusInactive')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPreviewId(tpl.id);
                          setPreviewProductId('');
                          setPreviewResult(null);
                        }}
                      >
                        {t('preview')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => startEdit(tpl)}>
                        {t('edit')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(tpl.id)}>
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

      {showForm ? (
        <div className="mt-6 space-y-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="text-lg font-semibold">{editingId ? t('editTitle') : t('newTitle')}</h3>

          <Input
            label={t('nameLabel')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t('namePh')}
          />

          <Input
            label={t('descLabel')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div>
            <p className="mb-2 text-sm font-medium">{t('channelsLabel')}</p>
            <div className="flex flex-wrap gap-2">
              {ALL_CHANNELS.map((ch) => (
                <label
                  key={ch}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                    form.channels.includes(ch)
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                      : 'border-[var(--color-border)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={form.channels.includes(ch)}
                    onChange={() => toggleChannel(ch)}
                  />
                  {ch}
                </label>
              ))}
            </div>
          </div>

          <Input
            label={t('titleLabel')}
            value={form.titleTemplate}
            onChange={(e) => setForm({ ...form, titleTemplate: e.target.value })}
            placeholder={t('titlePh')}
          />

          <div>
            <label className="mb-1 block text-sm font-medium">{t('contentLabel')}</label>
            <textarea
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              rows={6}
              value={form.contentTemplate}
              onChange={(e) => setForm({ ...form, contentTemplate: e.target.value })}
              placeholder={t('contentPh')}
            />
          </div>

          <Input
            label={t('hashtagsLabel')}
            value={form.hashtagsTemplate}
            onChange={(e) => setForm({ ...form, hashtagsTemplate: e.target.value })}
            placeholder={t('hashtagsPh')}
          />

          <Input
            label={t('firstCommentLabel')}
            value={form.firstComment}
            onChange={(e) => setForm({ ...form, firstComment: e.target.value })}
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            {t('activeLabel')}
          </label>

          <div className="flex gap-2">
            <Button onClick={submit}>{editingId ? t('save') : t('create')}</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {previewId !== null ? (
        <div className="mt-6 space-y-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <h3 className="text-lg font-semibold">{t('previewTitle')}</h3>
          <div className="flex items-end gap-2">
            <Input
              label={t('productIdLabel')}
              value={previewProductId}
              onChange={(e) => setPreviewProductId(e.target.value)}
              placeholder={t('productIdPh')}
            />
            <Button onClick={runPreview}>{t('generate')}</Button>
            <Button variant="ghost" onClick={() => setPreviewId(null)}>
              {t('close')}
            </Button>
          </div>
          {previewResult ? (
            <div className="space-y-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-xs uppercase text-[var(--color-text-secondary)]">
                {t('previewTitleLabel')}
              </p>
              <p className="font-semibold">{previewResult.title}</p>
              <p className="mt-2 text-xs uppercase text-[var(--color-text-secondary)]">
                {t('previewContentLabel')}
              </p>
              <p className="whitespace-pre-wrap">{previewResult.content}</p>
              {previewResult.hashtags ? (
                <>
                  <p className="mt-2 text-xs uppercase text-[var(--color-text-secondary)]">
                    {t('previewHashtagsLabel')}
                  </p>
                  <p className="text-[var(--color-primary)]">{previewResult.hashtags}</p>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove(deleteId)}
        title={t('deleteMsgTitle')}
        message={t('deleteMsg')}
        confirmText={t('confirmDelete')}
      />
    </div>
  );
}
