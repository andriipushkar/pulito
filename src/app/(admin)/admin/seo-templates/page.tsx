'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Check, Close, Eye } from '@/components/icons';

interface SeoTemplate {
  id: number;
  entityType: string;
  titleTemplate: string;
  descriptionTemplate: string;
  altTemplate: string | null;
  categoryId: number | null;
}

interface EditForm {
  entityType: string;
  titleTemplate: string;
  descriptionTemplate: string;
  altTemplate: string;
}

export default function AdminSeoTemplatesPage() {
  const t = useTranslations('admin.seoTemplatesPage');
  const SAMPLE_VALUES: Record<string, string> = {
    '{name}': t('sampleName'),
    '{code}': t('sampleCode'),
    '{category}': t('sampleCategory'),
    '{price}': t('samplePrice'),
  };
  const previewTemplate = (template: string): string => {
    let result = template;
    for (const [key, value] of Object.entries(SAMPLE_VALUES)) {
      result = result.replaceAll(key, value);
    }
    return result;
  };
  const [templates, setTemplates] = useState<SeoTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    entityType: 'product',
    titleTemplate: '',
    descriptionTemplate: '',
    altTemplate: '',
  });
  const [genResult, setGenResult] = useState<{ updated: number; total: number } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    entityType: 'product',
    titleTemplate: '',
    descriptionTemplate: '',
    altTemplate: '',
  });
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const loadTemplates = () => {
    apiClient
      .get<SeoTemplate[]>('/api/v1/admin/seo-templates')
      .then((res) => {
        if (res.success && res.data) setTemplates(res.data);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleCreate = async () => {
    const res = await apiClient.post('/api/v1/admin/seo-templates', form);
    if (res.success) {
      toast.success(t('createdToast'));
      setShowForm(false);
      setForm({
        entityType: 'product',
        titleTemplate: '',
        descriptionTemplate: '',
        altTemplate: '',
      });
      loadTemplates();
    } else {
      toast.error(res.error || t('createError'));
    }
  };

  const handleBulkGenerate = async () => {
    setConfirmGenerate(false);
    setIsGenerating(true);
    try {
      const res = await apiClient.post<{ updated: number; total: number }>(
        '/api/v1/admin/seo-templates/generate',
        {},
      );
      if (res.success && res.data) {
        setGenResult(res.data);
        toast.success(t('genSummary', { updated: res.data.updated, total: res.data.total }));
      } else {
        toast.error(t('genError'));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const executeDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/seo-templates/${id}`);
    if (res.success) {
      toast.success(t('deletedToast'));
      loadTemplates();
    } else toast.error(t('deleteError'));
  };

  const startEdit = (tpl: SeoTemplate) => {
    setEditingId(tpl.id);
    setEditForm({
      entityType: tpl.entityType,
      titleTemplate: tpl.titleTemplate,
      descriptionTemplate: tpl.descriptionTemplate,
      altTemplate: tpl.altTemplate || '',
    });
  };

  const saveEdit = async (id: number) => {
    const res = await apiClient.put(`/api/v1/admin/seo-templates/${id}`, editForm);
    if (res.success) toast.success(t('updatedToast'));
    else toast.error(res.error || t('errorGeneric'));
    setEditingId(null);
    loadTemplates();
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
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setConfirmGenerate(true)}
            isLoading={isGenerating}
            disabled={templates.length === 0}
            title={templates.length === 0 ? t('bulkGenTitleNone') : t('bulkGenTitle')}
          >
            {t('bulkGen')}
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? t('cancel') : t('create')}
          </Button>
        </div>
      </div>

      {genResult && (
        <div className="mb-4 rounded-[var(--radius)] bg-green-50 px-4 py-2 text-sm text-green-700">
          {t('genSummary', { updated: genResult.updated, total: genResult.total })}
        </div>
      )}

      <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
        {t('varsHint', { vars: '{name}, {code}, {category}, {price}' })}
      </p>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">{t('typeLabel')}</label>
              <select
                value={form.entityType}
                onChange={(e) => setForm({ ...form, entityType: e.target.value })}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                <option value="product">{t('typeProduct')}</option>
                <option value="category">{t('typeCategory')}</option>
                <option value="page">{t('typePage')}</option>
              </select>
            </div>
            <Input
              label={t('titleTpl')}
              value={form.titleTemplate}
              onChange={(e) => setForm({ ...form, titleTemplate: e.target.value })}
            />
            <Input
              label={t('descriptionTpl')}
              value={form.descriptionTemplate}
              onChange={(e) => setForm({ ...form, descriptionTemplate: e.target.value })}
            />
            <Input
              label={t('altTpl')}
              value={form.altTemplate}
              onChange={(e) => setForm({ ...form, altTemplate: e.target.value })}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleCreate}>{t('save')}</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3"
          >
            {editingId === tpl.id ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium">{t('typeLabel')}</label>
                    <select
                      value={editForm.entityType}
                      onChange={(e) => setEditForm({ ...editForm, entityType: e.target.value })}
                      className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
                    >
                      <option value="product">{t('typeProduct')}</option>
                      <option value="category">{t('typeCategory')}</option>
                      <option value="page">{t('typePage')}</option>
                    </select>
                  </div>
                  <input
                    placeholder={t('titleTpl')}
                    value={editForm.titleTemplate}
                    onChange={(e) => setEditForm({ ...editForm, titleTemplate: e.target.value })}
                    className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                  />
                  <input
                    placeholder={t('descriptionTpl')}
                    value={editForm.descriptionTemplate}
                    onChange={(e) =>
                      setEditForm({ ...editForm, descriptionTemplate: e.target.value })
                    }
                    className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                  />
                  <input
                    placeholder={t('altTpl')}
                    value={editForm.altTemplate}
                    onChange={(e) => setEditForm({ ...editForm, altTemplate: e.target.value })}
                    className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    aria-label={t('cancelEditAria')}
                    onClick={() => setEditingId(null)}
                    className="rounded-[var(--radius)] border border-[var(--color-border)] p-1.5"
                  >
                    <Close size={16} />
                  </button>
                  <button
                    aria-label={t('saveAria')}
                    onClick={() => saveEdit(tpl.id)}
                    className="rounded-[var(--radius)] bg-[var(--color-primary)] p-1.5 text-white"
                  >
                    <Check size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[var(--color-primary-50)] px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">
                    {tpl.entityType}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewId(previewId === tpl.id ? null : tpl.id)}
                      className="rounded-[var(--radius)] border border-[var(--color-border)] p-1 hover:bg-[var(--color-bg-secondary)]"
                      title={t('previewTitle')}
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={() => startEdit(tpl)}
                      className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)]"
                    >
                      {t('edit')}
                    </button>
                    <button
                      onClick={() => setDeleteId(tpl.id)}
                      className="text-xs text-[var(--color-danger)] hover:underline"
                    >
                      {t('delete')}
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm">
                  <strong>{t('titleColon')}</strong> {tpl.titleTemplate}
                </p>
                <p className="text-sm">
                  <strong>{t('descColon')}</strong> {tpl.descriptionTemplate}
                </p>
                {tpl.altTemplate && (
                  <p className="text-sm">
                    <strong>{t('altColon')}</strong> {tpl.altTemplate}
                  </p>
                )}

                {previewId === tpl.id && (
                  <div className="mt-3 rounded-[var(--radius)] bg-[var(--color-bg-secondary)] p-3">
                    <p className="mb-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                      {t('preview')}
                    </p>
                    <p className="text-sm text-blue-700">{previewTemplate(tpl.titleTemplate)}</p>
                    <p className="text-xs text-green-700">
                      {previewTemplate(tpl.descriptionTemplate)}
                    </p>
                    {tpl.altTemplate && (
                      <p className="text-xs text-gray-500">
                        {t('altColon')} {previewTemplate(tpl.altTemplate)}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {templates.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] py-12 text-center text-[var(--color-text-secondary)]">
            <span className="text-3xl" aria-hidden="true">
              🔍
            </span>
            <p className="text-sm font-medium">{t('emptyTitle')}</p>
            <p className="max-w-md text-xs">{t('emptyHint')}</p>
            <button
              onClick={() => setShowForm(true)}
              className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-dark)]"
            >
              {t('createFirst')}
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        variant="danger"
        message={t('deleteMsg')}
      />

      <ConfirmDialog
        isOpen={confirmGenerate}
        onClose={() => setConfirmGenerate(false)}
        onConfirm={handleBulkGenerate}
        title={t('confirmGenTitle')}
        message={t('confirmGenMsg')}
        confirmText={t('confirmGenBtn')}
        isLoading={isGenerating}
      />
    </div>
  );
}
