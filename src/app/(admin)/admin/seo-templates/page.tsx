'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
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

const SAMPLE_VALUES: Record<string, string> = {
  '{name}': 'Гель для прання Clean Pro',
  '{code}': 'CP-001',
  '{category}': 'Засоби для прання',
  '{price}': '189.00',
};

function previewTemplate(template: string): string {
  let result = template;
  for (const [key, value] of Object.entries(SAMPLE_VALUES)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

export default function AdminSeoTemplatesPage() {
  const [templates, setTemplates] = useState<SeoTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ entityType: 'product', titleTemplate: '', descriptionTemplate: '', altTemplate: '' });
  const [genResult, setGenResult] = useState<{ updated: number; total: number } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ entityType: 'product', titleTemplate: '', descriptionTemplate: '', altTemplate: '' });
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadTemplates = () => {
    apiClient.get<SeoTemplate[]>('/api/v1/admin/seo-templates').then((res) => {
      if (res.success && res.data) setTemplates(res.data);
    }).finally(() => setIsLoading(false));
  };

  useEffect(() => { loadTemplates(); }, []);

  const handleCreate = async () => {
    const res = await apiClient.post('/api/v1/admin/seo-templates', form);
    if (res.success) {
      toast.success('Шаблон створено');
      setShowForm(false);
      setForm({ entityType: 'product', titleTemplate: '', descriptionTemplate: '', altTemplate: '' });
      loadTemplates();
    } else {
      toast.error(res.error || 'Помилка створення');
    }
  };

  const handleBulkGenerate = async () => {
    const res = await apiClient.post<{ updated: number; total: number }>('/api/v1/admin/seo-templates/generate', {});
    if (res.success && res.data) {
      setGenResult(res.data);
      toast.success(`Оновлено ${res.data.updated} з ${res.data.total} товарів`);
    } else {
      toast.error('Помилка генерації');
    }
  };

  const executeDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/seo-templates/${id}`);
    if (res.success) { toast.success('Шаблон видалено'); loadTemplates(); }
    else toast.error('Помилка видалення');
  };

  const startEdit = (t: SeoTemplate) => {
    setEditingId(t.id);
    setEditForm({
      entityType: t.entityType,
      titleTemplate: t.titleTemplate,
      descriptionTemplate: t.descriptionTemplate,
      altTemplate: t.altTemplate || '',
    });
  };

  const saveEdit = async (id: number) => {
    const res = await apiClient.put(`/api/v1/admin/seo-templates/${id}`, editForm);
    if (res.success) toast.success('Шаблон оновлено');
    else toast.error(res.error || 'Помилка');
    setEditingId(null);
    loadTemplates();
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">SEO-шаблони</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleBulkGenerate}>Масова генерація</Button>
          <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Скасувати' : '+ Створити'}</Button>
        </div>
      </div>

      {genResult && (
        <div className="mb-4 rounded-[var(--radius)] bg-green-50 px-4 py-2 text-sm text-green-700">
          Оновлено {genResult.updated} з {genResult.total} товарів
        </div>
      )}

      <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
        Змінні: {'{name}'}, {'{code}'}, {'{category}'}, {'{price}'}
      </p>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Тип</label>
              <select
                value={form.entityType}
                onChange={(e) => setForm({ ...form, entityType: e.target.value })}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                <option value="product">Товар</option>
                <option value="category">Категорія</option>
                <option value="page">Сторінка</option>
              </select>
            </div>
            <Input label="Title шаблон" value={form.titleTemplate} onChange={(e) => setForm({ ...form, titleTemplate: e.target.value })} />
            <Input label="Description шаблон" value={form.descriptionTemplate} onChange={(e) => setForm({ ...form, descriptionTemplate: e.target.value })} />
            <Input label="Alt шаблон" value={form.altTemplate} onChange={(e) => setForm({ ...form, altTemplate: e.target.value })} />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleCreate}>Зберегти</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.id} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
            {editingId === t.id ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium">Тип</label>
                    <select
                      value={editForm.entityType}
                      onChange={(e) => setEditForm({ ...editForm, entityType: e.target.value })}
                      className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
                    >
                      <option value="product">Товар</option>
                      <option value="category">Категорія</option>
                      <option value="page">Сторінка</option>
                    </select>
                  </div>
                  <input
                    placeholder="Title шаблон"
                    value={editForm.titleTemplate}
                    onChange={(e) => setEditForm({ ...editForm, titleTemplate: e.target.value })}
                    className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                  />
                  <input
                    placeholder="Description шаблон"
                    value={editForm.descriptionTemplate}
                    onChange={(e) => setEditForm({ ...editForm, descriptionTemplate: e.target.value })}
                    className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                  />
                  <input
                    placeholder="Alt шаблон"
                    value={editForm.altTemplate}
                    onChange={(e) => setEditForm({ ...editForm, altTemplate: e.target.value })}
                    className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingId(null)} className="rounded-[var(--radius)] border border-[var(--color-border)] p-1.5"><Close size={16} /></button>
                  <button onClick={() => saveEdit(t.id)} className="rounded-[var(--radius)] bg-[var(--color-primary)] p-1.5 text-white"><Check size={16} /></button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[var(--color-primary-50)] px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">{t.entityType}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewId(previewId === t.id ? null : t.id)}
                      className="rounded-[var(--radius)] border border-[var(--color-border)] p-1 hover:bg-[var(--color-bg-secondary)]"
                      title="Попередній перегляд"
                    >
                      <Eye size={14} />
                    </button>
                    <button onClick={() => startEdit(t)} className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)]">Редагувати</button>
                    <button onClick={() => setDeleteId(t.id)} className="text-xs text-[var(--color-danger)] hover:underline">Видалити</button>
                  </div>
                </div>
                <p className="mt-2 text-sm"><strong>Title:</strong> {t.titleTemplate}</p>
                <p className="text-sm"><strong>Description:</strong> {t.descriptionTemplate}</p>
                {t.altTemplate && <p className="text-sm"><strong>Alt:</strong> {t.altTemplate}</p>}

                {previewId === t.id && (
                  <div className="mt-3 rounded-[var(--radius)] bg-[var(--color-bg-secondary)] p-3">
                    <p className="mb-1 text-xs font-semibold text-[var(--color-text-secondary)]">Попередній перегляд:</p>
                    <p className="text-sm text-blue-700">{previewTemplate(t.titleTemplate)}</p>
                    <p className="text-xs text-green-700">{previewTemplate(t.descriptionTemplate)}</p>
                    {t.altTemplate && <p className="text-xs text-gray-500">Alt: {previewTemplate(t.altTemplate)}</p>}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {templates.length === 0 && (
          <div className="py-8 text-center text-[var(--color-text-secondary)]">Шаблонів немає</div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        variant="danger"
        message="Видалити цей SEO-шаблон?"
      />
    </div>
  );
}
