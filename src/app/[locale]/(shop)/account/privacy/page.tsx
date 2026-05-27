'use client';

import { useState } from 'react';
import PageHeader from '@/components/account/PageHeader';
import Button from '@/components/ui/Button';
import { getAccessToken } from '@/lib/api-client';

export default function PrivacyPage() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setError(null);
    setDownloading(true);
    try {
      const token = getAccessToken();
      const res = await fetch('/api/v1/me/gdpr-export', {
        method: 'GET',
        credentials: 'include',
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
              'X-Requested-With': 'XMLHttpRequest',
            }
          : { 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!res.ok) {
        setError(`Помилка ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('content-disposition') || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      a.download = match?.[1] ?? `pulito-data-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <PageHeader
        icon={
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        }
        title="Приватність"
        subtitle="Керування персональними даними"
      />

      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
        <h2 className="mb-2 text-base font-semibold">Експорт ваших даних (GDPR ст.20)</h2>
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          Завантажте файл із усією інформацією, яку магазин зберігає про вас: профіль, адреси,
          замовлення, список бажань. Файл у форматі JSON.
        </p>
        <Button onClick={handleExport} isLoading={downloading}>
          Завантажити мої дані
        </Button>
        {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
        <p className="mt-4 text-xs text-[var(--color-text-secondary)]">
          Якщо вам потрібно видалити акаунт повністю — напишіть нам на{' '}
          <a
            href="mailto:privacy@pulito.trade"
            className="text-[var(--color-primary)] hover:underline"
          >
            privacy@pulito.trade
          </a>
          .
        </p>
      </div>
    </div>
  );
}
