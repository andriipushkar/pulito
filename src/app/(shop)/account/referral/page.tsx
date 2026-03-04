'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import PageHeader from '@/components/account/PageHeader';
import StatCard from '@/components/account/StatCard';

interface ReferralStats {
  referralCode: string;
  referralLink: string;
  totalReferred: number;
  convertedCount: number;
  totalBonusValue: number;
}

export default function ReferralPage() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiClient
      .get<ReferralStats>('/api/v1/me/referral')
      .then((res) => {
        if (res.success && res.data) setStats(res.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleCopy = async () => {
    if (!stats) return;
    await navigator.clipboard.writeText(stats.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  if (!stats) {
    return <p className="text-sm text-[var(--color-text-secondary)]">Не вдалося завантажити дані</p>;
  }

  const conversionRate = stats.totalReferred > 0
    ? ((stats.convertedCount / stats.totalReferred) * 100).toFixed(0)
    : '0';

  return (
    <div className="space-y-6">
      <PageHeader
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        }
        title="Реферальна програма"
        subtitle="Запрошуйте друзів та отримуйте бонуси"
      />

      {/* ── How it works ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] p-4 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-sm font-bold text-[var(--color-text)] shadow-sm">
            1
          </div>
          <p className="text-sm font-semibold text-[var(--color-text)]">Поділіться посиланням</p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Надішліть друзям ваше реферальне посилання</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] p-4 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-sm font-bold text-[var(--color-text)] shadow-sm">
            2
          </div>
          <p className="text-sm font-semibold text-[var(--color-text)]">Друг реєструється</p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Друг створює акаунт за вашим посиланням</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] p-4 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-sm font-bold text-[var(--color-text)] shadow-sm">
            3
          </div>
          <p className="text-sm font-semibold text-[var(--color-text)]">Отримуєте бонус</p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Ви отримуєте бонуси після першого замовлення друга</p>
        </div>
      </div>

      {/* ── Referral link ── */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)]">
        <div className="border-b border-[var(--color-border)] px-5 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-6.364-6.364L4.757 8.116A4.5 4.5 0 003 11.625" />
            </svg>
            Ваше реферальне посилання
          </p>
        </div>
        <div className="p-5">
          <div className="flex gap-2">
            <input
              readOnly
              value={stats.referralLink}
              className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-mono text-[var(--color-text)]"
            />
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 ${
                copied
                  ? 'bg-green-500 text-white'
                  : 'bg-[var(--color-text)] text-[var(--color-bg)] hover:shadow-md'
              }`}
            >
              {copied ? (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Скопійовано!
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                  Копіювати
                </>
              )}
            </button>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
            </svg>
            Код: <strong className="font-mono">{stats.referralCode}</strong>
          </p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Запрошено"
          value={stats.totalReferred}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          }
        />
        <StatCard
          label="Здійснили покупку"
          value={`${stats.convertedCount} (${conversionRate}%)`}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
          }
        />
        <StatCard
          label="Отримано бонусів"
          value={`${stats.totalBonusValue.toFixed(0)} ₴`}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          }
        />
      </div>
    </div>
  );
}
