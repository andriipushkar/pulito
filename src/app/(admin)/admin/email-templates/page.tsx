'use client';

import { useEffect, useState } from 'react';
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
  const [testResult, setTestResult] = useState('');

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
        setEditingTemplate(null);
        loadTemplates();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (tpl: EmailTemplate) => {
    await apiClient.put(`/api/v1/admin/email-templates/${tpl.id}`, { isActive: !tpl.isActive });
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
              <p className="mb-4 text-sm text-[var(--color-text-secondary)]">Тема: <strong>{editSubject}</strong></p>
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(editBody) }} />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium">Тіло листа (HTML)</label>
              <WysiwygEditor value={editBody} onChange={setEditBody} placeholder="Введіть вміст листа..." />
            </div>
          )}

          <div className="rounded-[var(--radius)] bg-[var(--color-bg-secondary)] p-3 text-xs text-[var(--color-text-secondary)]">
            <p className="font-semibold">Доступні змінні:</p>
            <p className="mt-1">{'{{name}}'} — Ім&apos;я клієнта, {'{{orderNumber}}'} — Номер замовлення, {'{{status}}'} — Статус, {'{{link}}'} — Посилання, {'{{amount}}'} — Сума</p>
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
                  setIsSendingTest(true);
                  setTestResult('');
                  const res = await apiClient.post(`/api/v1/admin/email-templates/${editingTemplate.id}/test`, {
                    email: testEmail,
                    subject: editSubject,
                    bodyHtml: editBody,
                  });
                  setTestResult(res.success ? 'Тестовий лист надіслано' : (res.error || 'Помилка'));
                  setIsSendingTest(false);
                  setTimeout(() => setTestResult(''), 5000);
                }}
                isLoading={isSendingTest}
                disabled={!testEmail}
              >
                Надіслати тест
              </Button>
            </div>
            {testResult && (
              <p className={`mt-2 text-xs ${testResult.includes('надіслано') ? 'text-green-600' : 'text-[var(--color-danger)]'}`}>
                {testResult}
              </p>
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
            <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-8 text-center text-[var(--color-text-secondary)]">
              Email-шаблонів немає
            </div>
          )}
        </div>
      )}
    </div>
  );
}
