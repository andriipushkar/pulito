'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('admin.emailTemplatesPage');
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
  const [versions, setVersions] = useState<
    Array<{
      id: number;
      version: number;
      subject: string;
      bodyHtml: string;
      createdAt: string;
      createdBy: number | null;
    }>
  >([]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<number | null>(null);

  // Sample values for preview — keep keys aligned with the hint below
  const SAMPLE_VARS: Record<string, string> = {
    name: t('sampleName'),
    orderNumber: 'PT-2026-00123',
    status: t('sampleStatus'),
    link: 'https://pulito.trade/orders/PT-2026-00123',
    amount: t('sampleAmount'),
    code: 'WELCOME10',
    discount: '10%',
    storeName: t('sampleStoreName'),
  };

  const substitute = (text: string) =>
    text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => SAMPLE_VARS[key] ?? `{{${key}}}`);

  const loadTemplates = () => {
    setIsLoading(true);
    apiClient
      .get<EmailTemplate[]>('/api/v1/admin/email-templates')
      .then((res) => {
        if (res.success && res.data) setTemplates(res.data);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadTemplates();
  }, []);

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
    if (!confirm(t('restoreConfirm'))) return;
    setRestoringVersionId(versionId);
    try {
      const res = await apiClient.post(
        `/api/v1/admin/email-templates/${editingTemplate.id}/versions/${versionId}/restore`,
      );
      if (res.success) {
        toast.success(t('restoredToast'));
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
        toast.error(res.error || t('restoreError'));
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
        toast.success(t('savedToast'));
        setEditingTemplate(null);
        loadTemplates();
      } else {
        toast.error(res.error || t('saveError'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (tpl: EmailTemplate) => {
    const res = await apiClient.put(`/api/v1/admin/email-templates/${tpl.id}`, {
      isActive: !tpl.isActive,
    });
    if (res.success) toast.success(tpl.isActive ? t('disabledToast') : t('enabledToast'));
    loadTemplates();
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (editingTemplate) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <button
              onClick={() => setEditingTemplate(null)}
              className="text-sm text-[var(--color-primary)] hover:underline"
            >
              {t('back')}
            </button>
            <h2 className="mt-1 text-xl font-bold">
              {t('editing')} {editingTemplate.templateKey}
            </h2>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? t('editor') : t('preview')}
            </Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              {t('save')}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <Input
            label={t('subjectLabel')}
            value={editSubject}
            onChange={(e) => setEditSubject(e.target.value)}
          />

          {showPreview ? (
            <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6">
              <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {t('subjectPrefix')}{' '}
                  <strong className="text-gray-800">
                    {previewWithVars ? substitute(editSubject) : editSubject}
                  </strong>
                </p>
                <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={previewWithVars}
                    onChange={(e) => setPreviewWithVars(e.target.checked)}
                    className="accent-[var(--color-primary)]"
                  />
                  {t('substituteVars')}
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
              <label className="mb-1 block text-sm font-medium">{t('bodyLabel')}</label>
              <WysiwygEditor value={editBody} onChange={setEditBody} placeholder={t('bodyPh')} />
            </div>
          )}

          <div className="rounded-[var(--radius)] bg-[var(--color-bg-secondary)] p-3 text-xs text-[var(--color-text-secondary)]">
            <p className="font-semibold">{t('varsTitle')}</p>
            <p className="mt-1">{t('varsList')}</p>
            <p className="mt-1 italic">{t('varsHint')}</p>
          </div>

          {/* Test email */}
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <p className="mb-2 text-sm font-semibold">{t('testTitle')}</p>
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('testEmailPh')}
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
                    toast.error(t('invalidEmail'));
                    return;
                  }
                  setIsSendingTest(true);
                  const res = await apiClient.post(
                    `/api/v1/admin/email-templates/${editingTemplate.id}/test`,
                    {
                      email: testEmail,
                      subject: editSubject,
                      bodyHtml: editBody,
                    },
                  );
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
              <p className="text-sm font-semibold">{t('versionsTitle')}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!editingTemplate) return;
                  setVersionsOpen((v) => !v);
                  if (!versionsOpen) loadVersions(editingTemplate.id);
                }}
              >
                {versionsOpen ? t('hide') : t('show')}
              </Button>
            </div>
            {versionsOpen && (
              <>
                {isLoadingVersions && (
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t('loadingVersions')}
                  </p>
                )}
                {!isLoadingVersions && versions.length === 0 && (
                  <p className="text-xs text-[var(--color-text-secondary)]">{t('noVersions')}</p>
                )}
                {versions.length > 0 && (
                  <table className="w-full text-xs">
                    <thead className="text-left text-[var(--color-text-secondary)]">
                      <tr>
                        <th className="px-2 py-1">{t('colVersion')}</th>
                        <th className="px-2 py-1">{t('colSubject')}</th>
                        <th className="px-2 py-1">{t('colDate')}</th>
                        <th className="px-2 py-1 text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map((v) => (
                        <tr key={v.id} className="border-t border-[var(--color-border)]">
                          <td className="px-2 py-1 font-mono">v{v.version}</td>
                          <td className="px-2 py-1">
                            <span className="truncate" title={v.subject}>
                              {v.subject}
                            </span>
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
                              {restoringVersionId === v.id ? t('restoring') : t('restore')}
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
      <h2 className="mb-4 text-xl font-bold">{t('title')}</h2>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{tpl.templateKey}</span>
                  {tpl.isMarketing && (
                    <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700">
                      {t('marketingBadge')}
                    </span>
                  )}
                  <span className="text-xs text-[var(--color-text-secondary)]">v{tpl.version}</span>
                </div>
                <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{tpl.subject}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {formatDate(tpl.updatedAt)}
                </span>
                <button
                  onClick={() => handleToggle(tpl)}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${tpl.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {tpl.isActive ? t('statusActive') : t('statusInactive')}
                </button>
                <Button size="sm" variant="outline" onClick={() => handleEdit(tpl)}>
                  {t('edit')}
                </Button>
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] py-12 text-center text-[var(--color-text-secondary)]">
              <span className="text-3xl" aria-hidden="true">
                📧
              </span>
              <p className="text-sm font-medium">{t('emptyTitle')}</p>
              <p className="max-w-md text-xs">{t('emptyHint')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
