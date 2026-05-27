'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { maskIp } from '@/utils/pii';

interface SecurityData {
  user: {
    twoFactorEnabled: boolean;
    isBlocked: boolean;
    blockedAt: string | null;
    blockedReason: string | null;
    lastLoginAt: string | null;
  };
  loginHistory: Array<{
    id: number;
    ipAddress: string | null;
    userAgent: string | null;
    device: string | null;
    browser: string | null;
    os: string | null;
    country: string | null;
    city: string | null;
    success: boolean;
    createdAt: string;
  }>;
}

// maskIp imported from @/utils/pii — single source of truth (the local
// version we had here drifted from the canonical implementation).
const maskIpDisplay = (ip: string | null): string => maskIp(ip) ?? '—';

export default function UserSecurityTab({ userId }: { userId: number }) {
  const [data, setData] = useState<SecurityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Cancel-on-unmount / userId-change so a slow response for a previously
    // selected user doesn't overwrite data already loaded for the new one.
    let cancelled = false;
    setIsLoading(true);
    apiClient
      .get<SecurityData>(`/api/v1/admin/users/${userId}/security`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setData(res.data);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (isLoading) return <p className="text-sm text-[var(--color-text-secondary)]">Завантаження…</p>;
  if (!data) return <p className="text-sm text-[var(--color-text-secondary)]">Немає даних</p>;

  return (
    <div className="space-y-4">
      {/* Top cards: 2FA / block / last login */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <p className="text-xs text-[var(--color-text-secondary)]">Двофакторна автентифікація</p>
          <p
            className={`mt-1 text-lg font-bold ${data.user.twoFactorEnabled ? 'text-emerald-600' : 'text-amber-600'}`}
          >
            {data.user.twoFactorEnabled ? '✓ Увімкнено' : '⚠ Вимкнено'}
          </p>
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <p className="text-xs text-[var(--color-text-secondary)]">Статус блокування</p>
          <p
            className={`mt-1 text-lg font-bold ${data.user.isBlocked ? 'text-red-600' : 'text-emerald-600'}`}
          >
            {data.user.isBlocked ? '🚫 Заблоковано' : '✓ Активний'}
          </p>
          {data.user.isBlocked && data.user.blockedReason && (
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Причина: {data.user.blockedReason}
            </p>
          )}
          {data.user.isBlocked && data.user.blockedAt && (
            <p className="text-[10px] text-[var(--color-text-secondary)]">
              {new Date(data.user.blockedAt).toLocaleString('uk-UA')}
            </p>
          )}
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <p className="text-xs text-[var(--color-text-secondary)]">Останній вхід</p>
          <p className="mt-1 text-sm font-medium">
            {data.user.lastLoginAt
              ? new Date(data.user.lastLoginAt).toLocaleString('uk-UA')
              : 'Ніколи не входив'}
          </p>
        </div>
      </div>

      {/* Login history table */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="text-sm font-semibold">Історія входу (останні 20)</h3>
        </div>
        {data.loginHistory.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
            Записів немає
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-3 py-2">Дата</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Пристрій</th>
                  <th className="px-3 py-2">Місцезнаходження</th>
                </tr>
              </thead>
              <tbody>
                {data.loginHistory.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      {new Date(entry.createdAt).toLocaleString('uk-UA')}
                    </td>
                    <td className="px-3 py-2">
                      {entry.success ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                          ✓ Успіх
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">
                          ✗ Помилка
                        </span>
                      )}
                    </td>
                    <td
                      className="px-3 py-2 font-mono text-[var(--color-text-secondary)]"
                      title="Замасковано для приватності"
                    >
                      {maskIpDisplay(entry.ipAddress)}
                    </td>
                    <td className="px-3 py-2">
                      {[entry.device, entry.browser, entry.os].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      {[entry.city, entry.country].filter(Boolean).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
