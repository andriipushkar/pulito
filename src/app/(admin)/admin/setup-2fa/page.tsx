'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';

export default function SecurityPage() {
  const t = useTranslations('admin.setup2faPage');
  const { user, isLoading, refreshAuth } = useAuth();
  const [step, setStep] = useState<'idle' | 'setup' | 'verify' | 'done'>('idle');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [, setOtpauthUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loginHistory, setLoginHistory] = useState<
    {
      id: number;
      ipAddress: string | null;
      device: string | null;
      browser: string | null;
      os: string | null;
      createdAt: string;
    }[]
  >([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [disableMode, setDisableMode] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  const handleDisable = async () => {
    if (disableCode.length !== 6) {
      toast.error(t('codeMustBe6'));
      return;
    }
    setIsProcessing(true);
    const res = await apiClient.post<{ twoFactorEnabled: boolean }>('/api/v1/auth/2fa/disable', {
      code: disableCode,
    });
    if (res.success) {
      toast.success(t('disabledToast'));
      setDisableMode(false);
      setDisableCode('');
      await refreshAuth();
    } else {
      toast.error(res.error || t('invalidCode'));
    }
    setIsProcessing(false);
  };

  const handleSetup = async () => {
    setIsProcessing(true);
    const res = await apiClient.post<{ secret: string; otpauthUrl: string; qrDataUrl: string }>(
      '/api/v1/auth/2fa/setup',
    );
    if (res.success && res.data) {
      setSecret(res.data.secret);
      setOtpauthUrl(res.data.otpauthUrl);
      setQrDataUrl(res.data.qrDataUrl);
      setStep('setup');
    } else {
      toast.error(res.error || t('setupError'));
    }
    setIsProcessing(false);
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error(t('codeMustBe6'));
      return;
    }
    setIsProcessing(true);
    const res = await apiClient.post<{ twoFactorEnabled: boolean; backupCodes: string[] }>(
      '/api/v1/auth/2fa/verify',
      { code },
    );
    if (res.success && res.data) {
      setBackupCodes(res.data.backupCodes);
      setStep('done');
      // Without this, AuthProvider's user.twoFactorEnabled stays false and the
      // admin layout's 2FA guard keeps redirecting the user back to setup.
      await refreshAuth();
      toast.success(t('enabledToast'));
    } else {
      toast.error(res.error || t('invalidCode'));
    }
    setIsProcessing(false);
  };

  const loadHistory = async () => {
    const res = await apiClient.get<typeof loginHistory>('/api/v1/me/login-history');
    if (res.success && res.data) {
      setLoginHistory(res.data);
      setHistoryLoaded(true);
    }
  };

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  if (!user) return <div className="py-12 text-center">{t('loginRequired')}</div>;

  const is2faEnabled = user.twoFactorEnabled;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      {/* 2FA Section */}
      <div className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
        <div className="mb-4 flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${is2faEnabled ? 'bg-green-100' : 'bg-amber-100'}`}
          >
            <svg
              className={`h-5 w-5 ${is2faEnabled ? 'text-green-600' : 'text-amber-600'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t('twoFaTitle')}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {is2faEnabled ? t('enabledHint') : t('disabledHint')}
            </p>
          </div>
          {is2faEnabled && (
            <span className="ml-auto rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
              {t('activeBadge')}
            </span>
          )}
        </div>

        {step === 'idle' && !is2faEnabled && (
          <div>
            <p className="mb-4 text-sm text-[var(--color-text-secondary)]">{t('introHint')}</p>
            <Button onClick={handleSetup} isLoading={isProcessing}>
              {t('enableBtn')}
            </Button>
          </div>
        )}

        {step === 'setup' && (
          <div>
            <div className="mb-4 rounded-lg bg-[var(--color-bg-secondary)] p-4">
              <p className="mb-3 text-sm font-medium">{t('step1')}</p>
              <div className="mb-3 flex justify-center rounded-lg bg-white p-4">
                {/* QR code via Google Charts API */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt={t('qrAlt')} width={250} height={250} />
              </div>
              <p className="mb-1 text-xs text-[var(--color-text-secondary)]">{t('manualSecret')}</p>
              <div className="flex items-center gap-2">
                <code className="block flex-1 break-all rounded bg-gray-100 px-3 py-2 text-xs font-mono">
                  {showSecret ? secret : '•'.repeat(Math.max(secret.length, 16))}
                </code>
                <button
                  type="button"
                  onClick={() => setShowSecret((s) => !s)}
                  className="shrink-0 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)]"
                  aria-label={showSecret ? t('hideSecret') : t('showSecret')}
                >
                  {showSecret ? t('hide') : t('show')}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(secret);
                      toast.success(t('secretCopied'));
                    } catch {
                      toast.error(t('copyError'));
                    }
                  }}
                  className="shrink-0 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)]"
                  aria-label={t('copySecretAria')}
                >
                  {t('copy')}
                </button>
              </div>
            </div>

            <div className="mb-4">
              <p className="mb-2 text-sm font-medium">{t('step2')}</p>
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-40 text-center text-lg font-mono tracking-widest"
                  autoFocus
                />
                <Button
                  onClick={handleVerify}
                  isLoading={isProcessing}
                  disabled={code.length !== 6}
                >
                  {t('confirm')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div>
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="mb-1 text-sm font-semibold text-green-800">{t('doneTitle')}</p>
              <p className="text-xs text-green-700">{t('doneHint')}</p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="mb-2 text-sm font-semibold text-amber-800">{t('backupTitle')}</p>
              <p className="mb-3 text-xs text-amber-700">{t('backupHint')}</p>
              <div className="grid grid-cols-2 gap-1">
                {backupCodes.map((bc, i) => (
                  <code
                    key={i}
                    className="rounded bg-white px-2 py-1 text-center text-xs font-mono"
                  >
                    {bc}
                  </code>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  navigator.clipboard.writeText(backupCodes.join('\n'));
                  toast.success(t('codesCopied'));
                }}
              >
                {t('copyCodes')}
              </Button>
            </div>
          </div>
        )}

        {is2faEnabled && step === 'idle' && !disableMode && (
          <div className="space-y-4">
            <p className="text-sm text-green-700">{t('enabledStatus')}</p>
            <Button variant="outline" onClick={() => setDisableMode(true)}>
              {t('disableBtn')}
            </Button>
          </div>
        )}

        {is2faEnabled && disableMode && (
          <div>
            <p className="mb-3 text-sm text-[var(--color-text-secondary)]">{t('disableHint')}</p>
            <div className="flex gap-2">
              <Input
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-40 text-center text-lg font-mono tracking-widest"
                autoFocus
              />
              <Button
                onClick={handleDisable}
                isLoading={isProcessing}
                disabled={disableCode.length !== 6}
              >
                {t('disable')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDisableMode(false);
                  setDisableCode('');
                }}
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Login History */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('historyTitle')}</h2>
          {!historyLoaded && (
            <Button variant="outline" size="sm" onClick={loadHistory}>
              {t('loadHistory')}
            </Button>
          )}
        </div>

        {historyLoaded ? (
          loginHistory.length > 0 ? (
            <div className="space-y-2">
              {loginHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-lg bg-[var(--color-bg-secondary)] px-4 py-2.5"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-bg)] text-xs">
                    {entry.device === 'mobile' ? '📱' : entry.device === 'tablet' ? '📱' : '💻'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {t('browserOn', {
                        browser: entry.browser || t('unknownBrowser'),
                        os: entry.os || t('unknownOs'),
                      })}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      IP: {entry.ipAddress || '—'} ·{' '}
                      {new Date(entry.createdAt).toLocaleString('uk-UA')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-[var(--color-text-secondary)]">
              <span className="text-2xl" aria-hidden="true">
                🔒
              </span>
              <p className="text-sm font-medium">{t('noActivity')}</p>
              <p className="text-xs">{t('noActivityHint')}</p>
            </div>
          )
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">{t('loadHistoryHint')}</p>
        )}
      </div>
    </div>
  );
}
