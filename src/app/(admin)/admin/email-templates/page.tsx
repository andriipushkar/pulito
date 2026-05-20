'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import WysiwygEditor from '@/components/admin/WysiwygEditor';
import { sanitizeHtml } from '@/utils/sanitize';

interface EmailTemplate {
  id: number;
  templateKey: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  version: number;
  isActive: boolean;
  isMarketing: boolean;
  updatedAt: string;
}

export default function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [previewWithVars, setPreviewWithVars] = useState(true);
  const [versions, setVersions] = useState<Array<{
    id: number;
    version: number;
    subject: string;
    bodyHtml: string;
    createdAt: string;
    createdBy: number | null;
  }>>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<number | null>(null);

  // Sample values for preview — keep keys aligned with the hint below
  const SAMPLE_VARS: Record<string, string> = {
    name: 'Андрій',
    orderNumber: 'PT-2026-00123',
    status: 'Підтверджено',
    link: 'https://pulito.trade/orders/PT-2026-00123',
    amount: '1 250 ₴',
    code: 'WELCOME10',
    discount: '10%',
    storeName: 'Pulito Trade',
  };

  const substitute = (text: string) =>
    text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => SAMPLE_VARS[key] ?? `{{${key}}}`);

  const loadTemplates = () => {
    setIsLoading(true);
    apiClient
      .get<EmailTemplate[]>('/api/v1/admin/email-templates')
      .then((res) => { if (res.success && res.data) setTemplates(res.data); })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadTemplates(); }, []);

  const handleEdit = (tpl: EmailTemplate) => {
    setEditingTemplate(tpl);
    setEditSubject(tpl.subject);
    setEditBody(tpl.bodyHtml);
    setShowPreview(false);
    setVersions([]);
    setVersionsOpen(false);
  };

  const loadVersions = async (templateId: number) => {
    setIsLoadingVersions(true);
    try {
      const res = await apiClient.get<typeof versions>(
        `/api/v1/admin/email-templates/${templateId}/versions`,
      );
      if (res.success && res.data) setVersions(res.data);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const restoreVersion = async (versionId: number) => {
    if (!editingTemplate) return;
    if (!confirm('Відновити цю версію? Поточний стан буде збережено як нову версію.')) return;
    setRestoringVersionId(versionId);
    try {
      const res = await apiClient.post(
        `/api/v1/admin/email-templates/${editingTemplate.id}/versions/${versionId}/restore`,
      );
      if (res.success) {
        toast.success('Версію відновлено');
        // Refresh template + versions
        const refreshed = await apiClient.get<EmailTemplate>(
          `/api/v1/admin/email-templates/${editingTemplate.id}`,
        );
        if (refreshed.success && refreshed.data) {
          setEditingTemplate(refreshed.data);
          setEditSubject(refreshed.data.subject);
          setEditBody(refreshed.data.bodyHtml);
        }
        loadVersions(editingTemplate.id);
      } else {
        toast.error(res.error || 'Не вдалося відновити');
      }
    } finally {
      setRestoringVersionId(null);
    }
  };

  const handleSave = async () => {
    if (!editingTemplate) return;
    setIsSaving(true);
    try {
      const res = await apiClient.put(`/api/v1/admin/email-templates/${editingTemplate.id}`, {
        subject: editSubject,
        bodyHtml: editBody,
      });
      if (res.success) {
        toast.success('Шаблон збережено');
        setEditingTemplate(null);
        loadTemplates();
      } else {
        toast.error(res.error || 'Помилка збереження');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (tpl: EmailTemplate) => {
    const res = await apiClient.put(`/api/v1/admin/email-templates/${tpl.id}`, { isActive: !tpl.isActive });
    if (res.success) toast.success(tpl.isActive ? 'Шаблон вимкнено' : 'Шаблон увімкнено');
    loadTemplates();
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (editingTemplate) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <button onClick={() => setEditingTemplate(null)} className="text-sm text-[var(--color-primary)] hover:underline">
              ← Назад до списку
            </button>
            <h2 className="mt-1 text-xl font-bold">Редагування: {editingTemplate.templateKey}</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? 'Редактор' : 'Попередній перегляд'}
            </Button>
            <Button onClick={handleSave} isLoading={isSaving}>Зберегти</Button>
          </div>
        </div>

        <div className="space-y-4">
          <Input label="Тема листа" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />

          {showPreview ? (
            <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6">
              <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Тема: <strong className="text-gray-800">{previewWithVars ? substitute(editSubject) : editSubject}</strong>
                </p>
                <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={previewWithVars}
                    onChange={(e) => setPreviewWithVars(e.target.checked)}
                    className="accent-[var(--color-primary)]"
                  />
                  Підставити зразкові змінні
                </label>
              </div>
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(previewWithVars ? substitute(editBody) : editBody),
                }}
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium">Тіло листа (HTML)</label>
              <WysiwygEditor value={editBody} onChange={setEditBody} placeholder="Введіть вміст листа..." />
            </div>
          )}

          <div className="rounded-[var(--radius)] bg-[var(--color-bg-secondary)] p-3 text-xs text-[var(--color-text-secondary)]">
            <p className="font-semibold">Доступні змінні:</p>
            <p className="mt-1">
              {'{{name}}'} — Ім&apos;я, {'{{orderNumber}}'} — Номер замовлення, {'{{status}}'} —
              Статус, {'{{link}}'} — Посилання, {'{{amount}}'} — Сума, {'{{code}}'} — Промокод,{' '}
              {'{{discount}}'} — Знижка, {'{{storeName}}'} — Назва магазину
            </p>
            <p className="mt-1 italic">
              Натисніть «Попередній перегляд» — і змінні підставляться зразковими значеннями
              (ім&apos;я «Андрій», замовлення «PT-2026-00123» тощо) для перевірки.
            </p>
          </div>

          {/* Test email */}
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <p className="mb-2 text-sm font-semibold">Тестовий лист</p>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Email для тесту..."
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!testEmail || !editingTemplate) return;
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
                    toast.error('Невірний формат email');
                    return;
                  }
                  setIsSendingTest(true);
                  const res = await apiClient.post(`/api/v1/admin/email-templates/${editingTemplate.id}/test`, {
                    email: testEmail,
                    subject: editSubject,
                    bodyHtml: editBody,
                  });
                  if (res.success) toast.success(`Тестовий лист надіслано на ${testEmail}`);
                  else toast.error(res.error || 'Помилка відправки');
                  setIsSendingTest(false);
                }}
                isLoading={isSendingTest}
                disabled={!testEmail}
              >
                Надіслати тест
              </Button>
            </div>
          </div>

          {/* Versions: list previous snapshots, allow restore. The restore
              endpoint snapshots the current state first → reversible. */}
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Історія версій</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!editingTemplate) return;
                  setVersionsOpen((v) => !v);
                  if (!versionsOpen) loadVersions(editingTemplate.id);
                }}
              >
                {versionsOpen ? 'Сховати' : 'Показати'}
              </Button>
            </div>
            {versionsOpen && (
              <>
                {isLoadingVersions && (
                  <p className="text-xs text-[var(--color-text-secondary)]">Завантаження…</p>
                )}
                {!isLoadingVersions && versions.length === 0 && (
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Версій ще немає — кожен PUT створює нову версію автоматично.
                  </p>
                )}
                {versions.length > 0 && (
                  <table className="w-full text-xs">
                    <thead className="text-left text-[var(--color-text-secondary)]">
                      <tr>
                        <th className="px-2 py-1">#</th>
                        <th className="px-2 py-1">Тема</th>
                        <th className="px-2 py-1">Дата</th>
                        <th className="px-2 py-1 text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map((v) => (
                        <tr key={v.id} className="border-t border-[var(--color-border)]">
                          <td className="px-2 py-1 font-mono">v{v.version}</td>
                          <td className="px-2 py-1">
                            <span className="truncate" title={v.subject}>{v.subject}</span>
                          </td>
                          <td className="px-2 py-1 text-[var(--color-text-secondary)]">
                            {new Date(v.createdAt).toLocaleString('uk-UA')}
                          </td>
                          <td className="px-2 py-1 text-right">
                            <button
                              onClick={() => restoreVersion(v.id)}
                              disabled={restoringVersionId === v.id}
                              className="text-[var(--color-primary)] hover:underline disabled:opacity-50"
                            >
                              {restoringVersionId === v.id ? '…' : '↻ Відновити'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Email-шаблони</h2>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="md" /></div>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => (
            <div key={tpl.id} className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{tpl.templateKey}</span>
                  {tpl.isMarketing && (
                    <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700">Маркетинг</span>
                  )}
                  <span className="text-xs text-[var(--color-text-secondary)]">v{tpl.version}</span>
                </div>
                <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{tpl.subject}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--color-text-secondary)]">{formatDate(tpl.updatedAt)}</span>
                <button
                  onClick={() => handleToggle(tpl)}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${tpl.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {tpl.isActive ? 'Активний' : 'Вимкнений'}
                </button>
                <Button size="sm" variant="outline" onClick={() => handleEdit(tpl)}>Редагувати</Button>
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] py-12 text-center text-[var(--color-text-secondary)]">
              <span className="text-3xl" aria-hidden="true">📧</span>
              <p className="text-sm font-medium">Email-шаблонів ще немає</p>
              <p className="max-w-md text-xs">
                Шаблони створюються автоматично через міграції — якщо їх немає, перевірте seed
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
