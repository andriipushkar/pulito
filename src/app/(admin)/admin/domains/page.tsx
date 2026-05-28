'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('admin.domainsPage');
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
      toast.error(t('validateDomain'));
      return;
    }
    setIsSubmitting(true);
    const res = await apiClient.post<DomainInfo>('/api/v1/admin/domains', {
      domain: newDomain.trim(),
    });
    setIsSubmitting(false);
    if (res.success) {
      toast.success(t('initiatedToast'));
      setNewDomain('');
      await fetchDomainInfo();
    } else {
      toast.error(res.error || t('errorGeneric'));
    }
  };

  const handleVerify = async () => {
    if (!info?.domain) return;
    setIsVerifying(true);
    const res = await apiClient.post<{ verified: boolean }>('/api/v1/admin/domains/verify', {
      domain: info.domain,
    });
    setIsVerifying(false);
    if (res.success && res.data?.verified) {
      toast.success(t('verifiedToast'));
      await fetchDomainInfo();
    } else {
      toast.error(t('dnsNotFound'));
    }
  };

  const handleRemove = async () => {
    if (!info?.domain) return;
    setConfirmRemove(false);
    const res = await apiClient.delete(`/api/v1/admin/domains/${info.domain}`);
    if (res.success) {
      toast.success(t('removedToast'));
      await fetchDomainInfo();
    } else {
      toast.error(t('removeError'));
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
    ? t('statusNotConfigured')
    : info.verified
      ? t('statusVerified')
      : t('statusPending');

  const statusColor = !info?.domain
    ? 'text-[var(--color-text-secondary)]'
    : info.verified
      ? 'text-green-600'
      : 'text-yellow-600';

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold">{t('title')}</h2>
      </div>

      {/* Current status */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
        <h3 className="mb-3 text-lg font-semibold">{t('currentStatus')}</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--color-text-secondary)]">{t('statusLabel')}</span>
          <span className={`text-sm font-medium ${statusColor}`}>{statusLabel}</span>
        </div>
        {info?.domain && (
          <div className="mt-2 flex items-center gap-3">
            <span className="text-sm text-[var(--color-text-secondary)]">{t('domainLabel')}</span>
            <span className="text-sm font-medium">{info.domain}</span>
          </div>
        )}
      </div>

      {/* Verification instructions */}
      {info?.domain && !info.verified && info.verificationToken && (
        <div className="mb-6 rounded-[var(--radius)] border border-yellow-300 bg-yellow-50 p-6 dark:border-yellow-700 dark:bg-yellow-900/20">
          <h3 className="mb-3 text-lg font-semibold">{t('verifyInstructions')}</h3>
          <p className="mb-3 text-sm text-[var(--color-text-secondary)]">{t('verifyHint')}</p>
          <div className="mb-3 space-y-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <div>
              <span className="text-xs text-[var(--color-text-secondary)]">{t('recordName')}</span>
              <code className="ml-2 rounded bg-[var(--color-bg-secondary)] px-2 py-0.5 text-sm">
                {info.txtRecordName}
              </code>
            </div>
            <div>
              <span className="text-xs text-[var(--color-text-secondary)]">{t('recordType')}</span>
              <code className="ml-2 rounded bg-[var(--color-bg-secondary)] px-2 py-0.5 text-sm">
                TXT
              </code>
            </div>
            <div>
              <span className="text-xs text-[var(--color-text-secondary)]">{t('recordValue')}</span>
              <code className="ml-2 rounded bg-[var(--color-bg-secondary)] px-2 py-0.5 text-sm">
                {info.verificationToken}
              </code>
            </div>
          </div>
          <p className="mb-4 text-xs text-[var(--color-text-secondary)]">{t('verifyAfterHint')}</p>
          <Button onClick={handleVerify} isLoading={isVerifying}>
            {t('verifyButton')}
          </Button>
        </div>
      )}

      {/* Add domain form */}
      {!info?.domain && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
          <h3 className="mb-3 text-lg font-semibold">{t('addDomain')}</h3>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label={t('domainInputLabel')}
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder={t('domainPlaceholder')}
              />
            </div>
            <Button onClick={handleInitiate} isLoading={isSubmitting}>
              {t('add')}
            </Button>
          </div>
        </div>
      )}

      {/* Remove domain */}
      {info?.domain && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
          <h3 className="mb-3 text-lg font-semibold">{t('removeDomain')}</h3>
          <p className="mb-3 text-sm text-[var(--color-text-secondary)]">{t('removeHint')}</p>
          <Button
            onClick={() => setConfirmRemove(true)}
            className="bg-[var(--color-danger)] text-white hover:opacity-90"
          >
            {t('removeButton')}
          </Button>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={handleRemove}
        title={t('removeDomain')}
        message={t('confirmRemoveMsg')}
        confirmText={t('confirmRemoveYes')}
      />
    </div>
  );
}
