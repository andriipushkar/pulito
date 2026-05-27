'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface ChurnEntry {
  userId: number;
  email: string;
  fullName: string;
  phone: string | null;
  ltv: number;
  ordersCount: number;
  lastOrderAt: string;
  daysSinceLastOrder: number;
}

interface ChurnResponse {
  entries: ChurnEntry[];
  minDaysSilent: number;
}

/**
 * "Churn radar" — top high-LTV customers who haven't ordered in 30+ days.
 * Dashboard widget so the owner can re-engage them (promo code, call, etc.)
 * before they're permanently lost to a competitor.
 */
export default function ChurnRadarWidget() {
  const [data, setData] = useState<ChurnResponse | null>(null);
  const [days, setDays] = useState(30);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiClient
      .get<ChurnResponse>(`/api/v1/admin/churn-radar?days=${days}&limit=10`)
      .then((res) => {
        if (!cancelled && res.success && res.data) setData(res.data);
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
          <h2 className="text-base font-bold">🎯 Радар відтоку</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Високо-LTV клієнти, які не замовляли ≥{days} днів
          </p>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-border)] text-xs font-medium">
          {[30, 60, 90].map((d) => (
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
              {d}д
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--color-bg-secondary)]" />
          ))}
        </div>
      ) : !data || data.entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
          Немає клієнтів у зоні ризику 🎉
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-3 py-2 text-left">Клієнт</th>
                <th className="px-3 py-2 text-right">LTV</th>
                <th className="px-3 py-2 text-right">Замовлень</th>
                <th className="px-3 py-2 text-right">Мовчить</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((c) => (
                <tr key={c.userId} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/users?search=${encodeURIComponent(c.email)}`}
                      className="hover:underline"
                    >
                      <div className="font-medium">{c.fullName || c.email}</div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {c.email}
                        {c.phone ? ` · ${c.phone}` : ''}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-[var(--color-primary)]">
                    {Math.round(c.ltv).toLocaleString('uk-UA')} ₴
                  </td>
                  <td className="px-3 py-2 text-right">{c.ordersCount}</td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        c.daysSinceLastOrder >= 90
                          ? 'bg-red-100 text-red-700'
                          : c.daysSinceLastOrder >= 60
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {c.daysSinceLastOrder}д
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
