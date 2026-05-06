'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';

const ALL_CHANNELS = ['telegram', 'viber', 'instagram', 'facebook', 'tiktok', 'site'] as const;
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
  const [items, setItems] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const load = () => {
    setIsLoading(true);
    apiClient
      .get<Template[]>('/api/v1/admin/publication-templates')
      .then((res) => {
        if (res.success && res.data) setItems(res.data);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const startEdit = (t: Template) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      description: t.description ?? '',
      channels: t.channels,
      titleTemplate: t.titleTemplate ?? '',
      contentTemplate: t.contentTemplate,
      hashtagsTemplate: t.hashtagsTemplate ?? '',
      firstComment: t.firstComment ?? '',
      isActive: t.isActive,
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
      toast.success(editingId ? 'Шаблон оновлено' : 'Шаблон створено');
      setShowForm(false);
      load();
    } else {
      toast.error(res.error || 'Помилка збереження');
    }
  };

  const remove = async (id: number) => {
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/publication-templates/${id}`);
    if (res.success) {
      toast.success('Шаблон видалено');
      load();
    } else {
      toast.error(res.error || 'Помилка видалення');
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
      toast.error(res.error || "Помилка прев'ю");
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
          <h2 className="text-xl font-bold">Шаблони публікацій</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Готові заготовки для постів. Підтримують плейсхолдери:{' '}
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
            , тощо.
          </p>
        </div>
        <Button onClick={startCreate}>+ Новий шаблон</Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] py-12 text-center text-[var(--color-text-secondary)]">
          Шаблонів ще немає. Створіть перший — і використовуйте при створенні публікацій.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-secondary)] text-left">
              <tr>
                <th className="px-4 py-2">Назва</th>
                <th className="px-4 py-2">Канали</th>
                <th className="px-4 py-2">Активний</th>
                <th className="px-4 py-2 text-right">Дії</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-2">
                    <div className="font-medium">{t.name}</div>
                    {t.description ? (
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {t.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-xs">{t.channels.join(', ')}</td>
                  <td className="px-4 py-2">{t.isActive ? 'Так' : 'Ні'}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPreviewId(t.id);
                          setPreviewProductId('');
                          setPreviewResult(null);
                        }}
                      >
                        Прев&#39;ю
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => startEdit(t)}>
                        Редагувати
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(t.id)}>
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

      {showForm ? (
        <div className="mt-6 space-y-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="text-lg font-semibold">
            {editingId ? 'Редагувати шаблон' : 'Новий шаблон'}
          </h3>

          <Input
            label="Назва *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Товар дня"
          />

          <Input
            label="Опис"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div>
            <p className="mb-2 text-sm font-medium">Канали *</p>
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
            label="Заголовок (опціонально)"
            value={form.titleTemplate}
            onChange={(e) => setForm({ ...form, titleTemplate: e.target.value })}
            placeholder="🔥 {{product.name}} зі знижкою!"
          />

          <div>
            <label className="mb-1 block text-sm font-medium">Контент *</label>
            <textarea
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              rows={6}
              value={form.contentTemplate}
              onChange={(e) => setForm({ ...form, contentTemplate: e.target.value })}
              placeholder="Спеціальна пропозиція: {{product.name}} тільки за {{product.price}} (–{{product.discount}}). Замовити: {{product.url}}"
            />
          </div>

          <Input
            label="Хештеги"
            value={form.hashtagsTemplate}
            onChange={(e) => setForm({ ...form, hashtagsTemplate: e.target.value })}
            placeholder="#акція #cleanshop #{{product.code}}"
          />

          <Input
            label="Перший коментар (Instagram)"
            value={form.firstComment}
            onChange={(e) => setForm({ ...form, firstComment: e.target.value })}
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Активний
          </label>

          <div className="flex gap-2">
            <Button onClick={submit}>{editingId ? 'Зберегти' : 'Створити'}</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Скасувати
            </Button>
          </div>
        </div>
      ) : null}

      {previewId !== null ? (
        <div className="mt-6 space-y-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <h3 className="text-lg font-semibold">Прев&#39;ю шаблону</h3>
          <div className="flex items-end gap-2">
            <Input
              label="ID товару (опціонально)"
              value={previewProductId}
              onChange={(e) => setPreviewProductId(e.target.value)}
              placeholder="42"
            />
            <Button onClick={runPreview}>Згенерувати</Button>
            <Button variant="ghost" onClick={() => setPreviewId(null)}>
              Закрити
            </Button>
          </div>
          {previewResult ? (
            <div className="space-y-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-xs uppercase text-[var(--color-text-secondary)]">Заголовок</p>
              <p className="font-semibold">{previewResult.title}</p>
              <p className="mt-2 text-xs uppercase text-[var(--color-text-secondary)]">Контент</p>
              <p className="whitespace-pre-wrap">{previewResult.content}</p>
              {previewResult.hashtags ? (
                <>
                  <p className="mt-2 text-xs uppercase text-[var(--color-text-secondary)]">
                    Хештеги
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
        title="Видалити шаблон"
        message="Видалення безповоротне. Продовжити?"
        confirmText="Так, видалити"
      />
    </div>
  );
}
