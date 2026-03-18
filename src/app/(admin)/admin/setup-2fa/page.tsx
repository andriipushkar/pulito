'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';

export default function SecurityPage() {
  const { user, isLoading } = useAuth();
  const [step, setStep] = useState<'idle' | 'setup' | 'verify' | 'done'>('idle');
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loginHistory, setLoginHistory] = useState<{ id: number; ipAddress: string | null; device: string | null; browser: string | null; os: string | null; createdAt: string }[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const handleSetup = async () => {
    setIsProcessing(true);
    const res = await apiClient.post<{ secret: string; otpauthUrl: string; qrDataUrl: string }>('/api/v1/auth/2fa/setup');
    if (res.success && res.data) {
      setSecret(res.data.secret);
      setOtpauthUrl(res.data.otpauthUrl);
      setQrDataUrl(res.data.qrDataUrl);
      setStep('setup');
    } else {
      toast.error(res.error || 'Помилка налаштування');
    }
    setIsProcessing(false);
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error('Код має містити 6 цифр');
      return;
    }
    setIsProcessing(true);
    const res = await apiClient.post<{ twoFactorEnabled: boolean; backupCodes: string[] }>('/api/v1/auth/2fa/verify', { code });
    if (res.success && res.data) {
      setBackupCodes(res.data.backupCodes);
      setStep('done');
      toast.success('2FA успішно увімкнено!');
    } else {
      toast.error(res.error || 'Невірний код');
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

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  if (!user) return <div className="py-12 text-center">Будь ласка, увійдіть в акаунт</div>;

  const is2faEnabled = user.twoFactorEnabled;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Безпека акаунту</h1>

      {/* 2FA Section */}
      <div className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${is2faEnabled ? 'bg-green-100' : 'bg-amber-100'}`}>
            <svg className={`h-5 w-5 ${is2faEnabled ? 'text-green-600' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Двофакторна автентифікація (2FA)</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {is2faEnabled ? 'Увімкнено — ваш акаунт захищено' : 'Вимкнено — рекомендуємо увімкнути'}
            </p>
          </div>
          {is2faEnabled && (
            <span className="ml-auto rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">Активна</span>
          )}
        </div>

        {step === 'idle' && !is2faEnabled && (
          <div>
            <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
              Двофакторна автентифікація додає додатковий рівень захисту. При вході потрібно буде ввести 6-значний код з додатку Google Authenticator або Authy.
            </p>
            <Button onClick={handleSetup} isLoading={isProcessing}>
              Увімкнути 2FA
            </Button>
          </div>
        )}

        {step === 'setup' && (
          <div>
            <div className="mb-4 rounded-lg bg-[var(--color-bg-secondary)] p-4">
              <p className="mb-3 text-sm font-medium">1. Відскануйте QR-код у додатку Google Authenticator:</p>
              <div className="mb-3 flex justify-center rounded-lg bg-white p-4">
                {/* QR code via Google Charts API */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="QR код для 2FA"
                  width={250}
                  height={250}
                />
              </div>
              <p className="mb-1 text-xs text-[var(--color-text-secondary)]">Або введіть секрет вручну:</p>
              <code className="block break-all rounded bg-gray-100 px-3 py-2 text-xs font-mono">{secret}</code>
            </div>

            <div className="mb-4">
              <p className="mb-2 text-sm font-medium">2. Введіть 6-значний код з додатку:</p>
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-40 text-center text-lg font-mono tracking-widest"
                  autoFocus
                />
                <Button onClick={handleVerify} isLoading={isProcessing} disabled={code.length !== 6}>
                  Підтвердити
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div>
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="mb-1 text-sm font-semibold text-green-800">2FA успішно увімкнено!</p>
              <p className="text-xs text-green-700">Тепер при кожному вході потрібно буде вводити код з додатку.</p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="mb-2 text-sm font-semibold text-amber-800">Збережіть резервні коди!</p>
              <p className="mb-3 text-xs text-amber-700">Ці коди можна використати для входу якщо ви втратите доступ до телефону. Кожен код одноразовий.</p>
              <div className="grid grid-cols-2 gap-1">
                {backupCodes.map((bc, i) => (
                  <code key={i} className="rounded bg-white px-2 py-1 text-center text-xs font-mono">{bc}</code>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  navigator.clipboard.writeText(backupCodes.join('\n'));
                  toast.success('Коди скопійовано');
                }}
              >
                Скопіювати коди
              </Button>
            </div>
          </div>
        )}

        {is2faEnabled && step === 'idle' && (
          <p className="text-sm text-green-700">
            Ваш акаунт захищено двофакторною автентифікацією. При вході вам потрібно вводити код з Google Authenticator.
          </p>
        )}
      </div>

      {/* Login History */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Історія входів</h2>
          {!historyLoaded && (
            <Button variant="outline" size="sm" onClick={loadHistory}>Завантажити</Button>
          )}
        </div>

        {historyLoaded ? (
          loginHistory.length > 0 ? (
            <div className="space-y-2">
              {loginHistory.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 rounded-lg bg-[var(--color-bg-secondary)] px-4 py-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-bg)] text-xs">
                    {entry.device === 'mobile' ? '📱' : entry.device === 'tablet' ? '📱' : '💻'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {entry.browser || 'Невідомий'} на {entry.os || 'Невідомо'}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      IP: {entry.ipAddress || '—'} · {new Date(entry.createdAt).toLocaleString('uk-UA')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">Немає записів</p>
          )
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Натисніть "Завантажити" щоб побачити останні входи у ваш акаунт
          </p>
        )}
      </div>
    </div>
  );
}
