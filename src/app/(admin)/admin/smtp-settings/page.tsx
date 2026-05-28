'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface TestResult {
  success: boolean;
  name?: string;
  error?: string;
}

export default function SmtpSettingsPage() {
  const t = useTranslations('admin.smtpSettingsPage');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(new Set<string>());
  const [showPass, setShowPass] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testEmail, setTestEmail] = useState('');

  // Reload via token bump; fetch lives in the effect.
  const [reloadToken, setReloadToken] = useState(0);
  const loadSettings = useCallback(async () => {
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiClient.get<Record<string, string>>('/api/v1/admin/smtp-settings').then((res) => {
      if (cancelled) return;
      if (res.success && res.data) {
        setSettings(res.data);
        setDirty(new Set());
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const updateField = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty((prev) => new Set(prev).add(key));
  };

  const handleSave = async () => {
    setConfirmSave(false);
    setIsSaving(true);
    const res = await apiClient.put('/api/v1/admin/smtp-settings', settings);
    if (res.success) {
      toast.success(t('savedToast'));
      await loadSettings();
    } else {
      toast.error(res.error || t('saveError'));
    }
    setIsSaving(false);
  };

  const handleTest = async () => {
    if (testEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(testEmail)) {
      toast.error(t('invalidEmail'));
      return;
    }
    setTesting(true);
    setTestResult(null);
    const res = await apiClient.post<TestResult>('/api/v1/admin/smtp-settings/test', {
      config: {
        host: settings.smtp_host,
        port: settings.smtp_port,
        user: settings.smtp_user,
        pass: settings.smtp_pass,
        from: settings.smtp_from,
        fromName: settings.smtp_from_name,
        secure: settings.smtp_secure,
      },
      testEmail: testEmail || undefined,
    });
    setTestResult(
      res.success && res.data ? res.data : { success: false, error: t('requestError') },
    );
    setTesting(false);
  };

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{t('title')}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('intro')}</p>
        </div>
        <Button
          onClick={() => setConfirmSave(true)}
          isLoading={isSaving}
          disabled={dirty.size === 0}
        >
          {t('save')}
        </Button>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="text-2xl">📧</span>
          <div>
            <h3 className="font-semibold">{t('smtpServer')}</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">{t('smtpHint')}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label={t('hostLabel')}
            value={settings.smtp_host || ''}
            onChange={(e) => updateField('smtp_host', e.target.value)}
            placeholder="smtp.gmail.com"
          />
          <Input
            label={t('portLabel')}
            type="number"
            value={settings.smtp_port || ''}
            onChange={(e) => updateField('smtp_port', e.target.value)}
            placeholder="587"
          />
          <Input
            label={t('userLabel')}
            value={settings.smtp_user || ''}
            onChange={(e) => updateField('smtp_user', e.target.value)}
            placeholder="your@gmail.com"
          />
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
              {t('passLabel')}
            </label>
            <div className="relative">
              <Input
                type={showPass ? 'text' : 'password'}
                value={settings.smtp_pass || ''}
                onChange={(e) => updateField('smtp_pass', e.target.value)}
                placeholder="App password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-xs text-[var(--color-text-secondary)]"
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
            <p className="mt-0.5 text-[10px] text-[var(--color-text-secondary)]">{t('passHint')}</p>
          </div>
          <Input
            label={t('fromLabel')}
            value={settings.smtp_from || ''}
            onChange={(e) => updateField('smtp_from', e.target.value)}
            placeholder="noreply@pulito.trade"
          />
          <Input
            label={t('fromNameLabel')}
            value={settings.smtp_from_name || ''}
            onChange={(e) => updateField('smtp_from_name', e.target.value)}
            placeholder="Pulito Trade"
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.smtp_secure === 'true'}
                onChange={(e) => updateField('smtp_secure', e.target.checked ? 'true' : 'false')}
                className="accent-[var(--color-primary)]"
              />
              {t('secureLabel')}
            </label>
          </div>
        </div>

        {/* Test connection */}
        <div className="mt-6 border-t border-[var(--color-border)] pt-4">
          <h4 className="mb-3 text-sm font-semibold">{t('testConnection')}</h4>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <Input
                label={t('testEmailLabel')}
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !settings.smtp_host}
            >
              {testing ? t('testing') : testEmail ? t('sendTestEmail') : t('testConnection')}
            </Button>
          </div>
          {testResult && (
            <div
              className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {testResult.success ? `✅ ${testResult.name}` : `❌ ${testResult.error}`}
            </div>
          )}
        </div>
      </div>

      {/* Max file size */}
      <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-2xl">📎</span>
          <div>
            <h3 className="font-semibold">{t('fileLimitTitle')}</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">{t('fileLimitHint')}</p>
          </div>
        </div>
        <div className="max-w-xs">
          <Input
            label={t('fileSizeLabel')}
            type="number"
            value={settings.max_file_size_mb || ''}
            onChange={(e) => updateField('max_file_size_mb', e.target.value)}
            placeholder="10"
          />
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmSave}
        onClose={() => setConfirmSave(false)}
        onConfirm={handleSave}
        title={t('confirmTitle')}
        message={t('confirmMsg')}
        confirmText={t('confirmYes')}
      />
    </div>
  );
}
