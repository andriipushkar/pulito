'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import PageHeader from '@/components/account/PageHeader';
import StatCard from '@/components/account/StatCard';

interface LoyaltyDashboard {
  account: { points: number; totalSpent: number; level: string };
  currentLevel: { name: string; discountPercent: number; pointsMultiplier: number } | null;
  nextLevel: { name: string; minSpent: number } | null;
  recentTransactions: { id: number; type: string; points: number; description: string; createdAt: string }[];
}

const LEVEL_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#9CA3AF',
  gold: '#F59E0B',
  platinum: '#8B5CF6',
};

const LEVEL_GRADIENTS: Record<string, string> = {
  bronze: 'from-amber-600 to-amber-800',
  silver: 'from-gray-400 to-gray-600',
  gold: 'from-yellow-400 to-amber-500',
  platinum: 'from-violet-400 to-purple-600',
};

const LEVEL_BG: Record<string, string> = {
  bronze: 'bg-amber-50',
  silver: 'bg-gray-50',
  gold: 'bg-yellow-50',
  platinum: 'bg-violet-50',
};

const TYPE_LABELS: Record<string, string> = {
  earn: 'Нарахування',
  spend: 'Списання',
  manual_add: 'Ручне нарахування',
  manual_deduct: 'Ручне списання',
  expire: 'Згоряння',
};

const TYPE_ICONS: Record<string, string> = {
  earn: 'M12 4v16m8-8H4',
  spend: 'M19.5 12h-15',
  manual_add: 'M12 4v16m8-8H4',
  manual_deduct: 'M19.5 12h-15',
  expire: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
};

export default function LoyaltyPage() {
  const [data, setData] = useState<LoyaltyDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<LoyaltyDashboard>('/api/v1/me/loyalty')
      .then((res) => {
        if (res.success && res.data) setData(res.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  if (!data) {
    return <p className="text-sm text-[var(--color-text-secondary)]">Не вдалося завантажити дані</p>;
  }

  const { account, currentLevel, nextLevel, recentTransactions } = data;
  const levelColor = LEVEL_COLORS[account.level] || 'var(--color-primary)';
  const progressToNext = nextLevel
    ? Math.min(100, (account.totalSpent / Number(nextLevel.minSpent)) * 100)
    : 100;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6" />
            <path d="M12 12V3" />
            <path d="M20 7H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1Z" />
            <path d="M12 3l-4 4" />
            <path d="M12 3l4 4" />
          </svg>
        }
        title="Бонусна програма"
        subtitle={currentLevel ? `Рівень: ${account.level} — знижка ${currentLevel.discountPercent}%` : undefined}
      />

      {/* ── Level badge ── */}
      <div className={`relative overflow-hidden rounded-2xl border border-l-4 p-5 ${LEVEL_BG[account.level] || 'bg-blue-50'} border-opacity-30`} style={{ borderColor: levelColor, borderLeftColor: levelColor }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${LEVEL_BG[account.level] || 'bg-blue-50'}`} style={{ color: levelColor }}>
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-3.77 1.522m0 0a6.003 6.003 0 01-3.77-1.522" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Ваш рівень</p>
              <p className="text-xl font-bold capitalize" style={{ color: levelColor }}>{account.level}</p>
              {currentLevel && (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Знижка {currentLevel.discountPercent}% &middot; Множник x{currentLevel.pointsMultiplier}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold" style={{ color: levelColor }}>{account.points}</p>
            <p className="text-xs font-medium text-[var(--color-text-secondary)]">балів на рахунку</p>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Баланс балів"
          value={account.points}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          }
        />
        <StatCard
          label="Загальні витрати"
          value={`${account.totalSpent.toFixed(0)} ₴`}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          }
        />
        <StatCard
          label="Знижка"
          value={currentLevel ? `${currentLevel.discountPercent}%` : '—'}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
            </svg>
          }
        />
      </div>

      {/* ── Progress to next level ── */}
      {nextLevel && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">
              До рівня <strong className="capitalize">{nextLevel.name}</strong>
            </span>
            <span className="text-sm font-semibold" style={{ color: LEVEL_COLORS[nextLevel.name] || levelColor }}>
              {progressToNext.toFixed(0)}%
            </span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progressToNext}%`,
                background: `linear-gradient(90deg, ${levelColor}, ${LEVEL_COLORS[nextLevel.name] || levelColor})`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            {account.totalSpent.toFixed(0)} / {Number(nextLevel.minSpent).toFixed(0)} ₴
          </p>
        </div>
      )}

      {/* ── Recent transactions ── */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          Останні транзакції
        </h3>
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)]">
          {recentTransactions.map((tx, idx) => (
            <div key={tx.id} className={`group flex items-center justify-between px-4 py-3${idx < recentTransactions.length - 1 ? ' border-b border-[var(--color-border)]/60' : ''}`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tx.points >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={TYPE_ICONS[tx.type] || 'M12 4v16m8-8H4'} />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium">{tx.description}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {TYPE_LABELS[tx.type] || tx.type} &middot; {new Date(tx.createdAt).toLocaleDateString('uk-UA')}
                  </p>
                </div>
              </div>
              <span className={`text-sm font-bold ${tx.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {tx.points > 0 ? '+' : ''}{tx.points}
              </span>
            </div>
          ))}
          {recentTransactions.length === 0 && (
            <div className="bg-[var(--color-bg-secondary)]/40 rounded-2xl py-6 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">Немає транзакцій</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
