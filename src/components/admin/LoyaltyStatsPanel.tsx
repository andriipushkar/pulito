'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface LoyaltyStats {
  windowDays: number;
  earned: number;
  spent: number;
  expired: number;
  adjusted: number;
  totalLiability: number;
  topHolders: {
    userId: number;
    email: string;
    fullName: string;
    points: number;
    level: string;
    totalSpent: number;
  }[];
}

const LEVEL_BADGE: Record<string, string> = {
  bronze: 'bg-amber-100 text-amber-800',
  silver: 'bg-slate-100 text-slate-700',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-cyan-100 text-cyan-800',
};

/**
 * Admin overview of the loyalty program: how many points are circulating
 * (issued vs spent vs expired), current liability, top point holders.
 * Polled on mount, period selector for 7/30/90 days.
 */
export default function LoyaltyStatsPanel() {
  const t = useTranslations('admin.loyaltyStatsPanel');
  const [stats, setStats] = useState<LoyaltyStats | null>(null);
  const [days, setDays] = useState(30);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiClient
      .get<LoyaltyStats>(`/api/v1/admin/loyalty/stats?days=${days}`)
      .then((res) => {
        if (!cancelled && res.success && res.data) setStats(res.data);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  return (
    <div className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">{t('title')}</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">{t('roiSubtitle', { days })}</p>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-border)] text-xs font-medium">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 transition-colors ${
                days === d
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
              }`}
            >
              {t('dayBtn', { days: d })}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
            />
          ))}
        </div>
      )}

      {!isLoading && stats && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <StatBox
              label={t('earnedLabel')}
              value={stats.earned.toLocaleString('uk-UA')}
              hint={t('earnedHint')}
              tone="green"
            />
            <StatBox
              label={t('spentLabel')}
              value={stats.spent.toLocaleString('uk-UA')}
              hint={t('spentHint')}
              tone="blue"
            />
            <StatBox
              label={t('expiredLabel')}
              value={stats.expired.toLocaleString('uk-UA')}
              hint={t('expiredHint')}
              tone="gray"
            />
            <StatBox
              label={t('liabilityLabel')}
              value={stats.totalLiability.toLocaleString('uk-UA')}
              hint={t('liabilityHint', {
                amount: Math.round(stats.totalLiability).toLocaleString('uk-UA'),
              })}
              tone="orange"
            />
          </div>

          <div className="mt-5">
            <h3 className="mb-2 text-sm font-semibold">{t('topHoldersTitle')}</h3>
            {stats.topHolders.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)]">{t('noHolders')}</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)]">
                    <tr>
                      <th className="px-3 py-2 text-left">{t('colClient')}</th>
                      <th className="px-3 py-2 text-left">{t('colLevel')}</th>
                      <th className="px-3 py-2 text-right">{t('colPoints')}</th>
                      <th className="px-3 py-2 text-right">{t('colTotalSpent')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topHolders.map((h) => (
                      <tr key={h.userId} className="border-t border-[var(--color-border)]">
                        <td className="px-3 py-2">
                          <Link
                            href={`/admin/users?search=${encodeURIComponent(h.email)}`}
                            className="hover:underline"
                          >
                            <div className="font-medium">{h.fullName || h.email}</div>
                            <div className="text-xs text-[var(--color-text-secondary)]">
                              {h.email}
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              LEVEL_BADGE[h.level.toLowerCase()] || 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {h.level}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {h.points.toLocaleString('uk-UA')}
                        </td>
                        <td className="px-3 py-2 text-right text-[var(--color-text-secondary)]">
                          {Math.round(h.totalSpent).toLocaleString('uk-UA')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'green' | 'blue' | 'gray' | 'orange';
}) {
  const toneClass = {
    green: 'border-green-200 bg-green-50',
    blue: 'border-blue-200 bg-blue-50',
    gray: 'border-gray-200 bg-gray-50',
    orange: 'border-orange-200 bg-orange-50',
  }[tone];
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      <div className="mt-0.5 text-[10px] text-[var(--color-text-secondary)]">{hint}</div>
    </div>
  );
}
