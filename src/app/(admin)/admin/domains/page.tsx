'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface DomainInfo {
  domain: string | null;
  verified: boolean;
  verificationToken: string | null;
  txtRecordName: string | null;
}

export default function AdminDomainsPage() {
  const [info, setInfo] = useState<DomainInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Bump reloadToken to trigger a refetch; effect performs the async fetch
  // so setState runs only in the async callback.
  const [reloadToken, setReloadToken] = useState(0);
  const fetchDomainInfo = async () => {
    setReloadToken((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    apiClient.get<DomainInfo>('/api/v1/admin/domains').then((res) => {
      if (cancelled) return;
      if (res.success && res.data) {
        setInfo(res.data);
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const handleInitiate = async () => {
    if (!newDomain.trim()) {
      toast.error('Введіть домен');
      return;
    }
    setIsSubmitting(true);
    const res = await apiClient.post<DomainInfo>('/api/v1/admin/domains', {
      domain: newDomain.trim(),
    });
    setIsSubmitting(false);
    if (res.success) {
      toast.success('Верифікацію ініційовано');
      setNewDomain('');
      await fetchDomainInfo();
    } else {
      toast.error(res.error || 'Помилка');
    }
  };

  const handleVerify = async () => {
    if (!info?.domain) return;
    setIsVerifying(true);
    const res = await apiClient.post<{ verified: boolean }>(
      '/api/v1/admin/domains/verify',
      { domain: info.domain }
    );
    setIsVerifying(false);
    if (res.success && res.data?.verified) {
      toast.success('Домен верифіковано!');
      await fetchDomainInfo();
    } else {
      toast.error('DNS-запис не знайдено. Переконайтеся, що TXT-запис додано.');
    }
  };

  const handleRemove = async () => {
    if (!info?.domain) return;
    setConfirmRemove(false);
    const res = await apiClient.delete(`/api/v1/admin/domains/${info.domain}`);
    if (res.success) {
      toast.success('Домен видалено');
      await fetchDomainInfo();
    } else {
      toast.error('Помилка видалення');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  const statusLabel = !info?.domain
    ? 'Не налаштовано'
    : info.verified
      ? 'Верифіковано'
      : 'Очікує верифікації';

  const statusColor = !info?.domain
    ? 'text-[var(--color-text-secondary)]'
    : info.verified
      ? 'text-green-600'
      : 'text-yellow-600';

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold">Власний домен</h2>
      </div>

      {/* Current status */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
        <h3 className="mb-3 text-lg font-semibold">Поточний статус</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--color-text-secondary)]">Статус:</span>
          <span className={`text-sm font-medium ${statusColor}`}>{statusLabel}</span>
        </div>
        {info?.domain && (
          <div className="mt-2 flex items-center gap-3">
            <span className="text-sm text-[var(--color-text-secondary)]">Домен:</span>
            <span className="text-sm font-medium">{info.domain}</span>
          </div>
        )}
      </div>

      {/* Verification instructions */}
      {info?.domain && !info.verified && info.verificationToken && (
        <div className="mb-6 rounded-[var(--radius)] border border-yellow-300 bg-yellow-50 p-6 dark:border-yellow-700 dark:bg-yellow-900/20">
          <h3 className="mb-3 text-lg font-semibold">Інструкції з верифікації</h3>
          <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
            Додайте TXT-запис до DNS-налаштувань вашого домену:
          </p>
          <div className="mb-3 space-y-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <div>
              <span className="text-xs text-[var(--color-text-secondary)]">Ім&apos;я запису:</span>
              <code className="ml-2 rounded bg-[var(--color-bg-secondary)] px-2 py-0.5 text-sm">
                {info.txtRecordName}
              </code>
            </div>
            <div>
              <span className="text-xs text-[var(--color-text-secondary)]">Тип:</span>
              <code className="ml-2 rounded bg-[var(--color-bg-secondary)] px-2 py-0.5 text-sm">
                TXT
              </code>
            </div>
            <div>
              <span className="text-xs text-[var(--color-text-secondary)]">Значення:</span>
              <code className="ml-2 rounded bg-[var(--color-bg-secondary)] px-2 py-0.5 text-sm">
                {info.verificationToken}
              </code>
            </div>
          </div>
          <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
            Після додавання запису зачекайте кілька хвилин для поширення DNS і натисніть кнопку нижче.
          </p>
          <Button onClick={handleVerify} isLoading={isVerifying}>
            Перевірити DNS
          </Button>
        </div>
      )}

      {/* Add domain form */}
      {!info?.domain && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
          <h3 className="mb-3 text-lg font-semibold">Додати домен</h3>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label="Домен"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="shop.example.com"
              />
            </div>
            <Button onClick={handleInitiate} isLoading={isSubmitting}>
              Додати
            </Button>
          </div>
        </div>
      )}

      {/* Remove domain */}
      {info?.domain && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
          <h3 className="mb-3 text-lg font-semibold">Видалити домен</h3>
          <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
            Видалення домену зробить магазин доступним лише за стандартною адресою.
          </p>
          <Button
            onClick={() => setConfirmRemove(true)}
            className="bg-[var(--color-danger)] text-white hover:opacity-90"
          >
            Видалити домен
          </Button>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={handleRemove}
        title="Видалити домен"
        message="Ви впевнені, що хочете видалити прив'язку домену? Це не можна скасувати."
        confirmText="Так, видалити"
      />
    </div>
  );
}
