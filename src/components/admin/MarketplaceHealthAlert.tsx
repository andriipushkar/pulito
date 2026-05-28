'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface TokenExpiry {
  platform: string;
  hasToken: boolean;
  daysRemaining: number | null;
  health: 'unknown' | 'fresh' | 'warn' | 'critical' | 'expired' | 'no-token';
}

const PLATFORM_LABEL: Record<string, string> = {
  olx: 'OLX',
  rozetka: 'Rozetka',
  prom: 'Prom.ua',
  epicentrk: 'Epicentr',
};

/**
 * MarketplaceHealthAlert — banner at the top of any admin page that warns
 * about marketplace tokens about to expire or already broken. Silent when
 * everything's healthy or no marketplaces are connected. Dismissible per
 * session (localStorage) so it doesn't haunt the manager all day.
 */
export default function MarketplaceHealthAlert() {
  const t = useTranslations('admin.marketplaceHealthAlert');
  const [issues, setIssues] = useState<TokenExpiry[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Skip when dismissed for this session.
    if (typeof window !== 'undefined') {
      const today = new Date().toISOString().slice(0, 10);
      if (window.sessionStorage.getItem('mp-health-dismissed') === today) {
        setDismissed(true);
        return;
      }
    }
    apiClient
      .get<TokenExpiry[]>('/api/v1/admin/marketplaces/token-expiry')
      .then((res) => {
        if (!res.success || !res.data) return;
        const flagged = res.data.filter(
          (t) => t.hasToken && ['critical', 'expired', 'warn'].includes(t.health),
        );
        setIssues(flagged);
      })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem('mp-health-dismissed', new Date().toISOString().slice(0, 10));
    } catch {
      /* ignore */
    }
  };

  if (dismissed || issues.length === 0) return null;

  const expired = issues.filter((t) => t.health === 'expired');
  const critical = issues.filter((t) => t.health === 'critical');
  const warn = issues.filter((t) => t.health === 'warn');

  // Pick the worst severity for banner color.
  const tone =
    expired.length > 0
      ? 'bg-red-50 border-red-300 text-red-800'
      : critical.length > 0
        ? 'bg-orange-50 border-orange-300 text-orange-800'
        : 'bg-amber-50 border-amber-300 text-amber-800';

  return (
    <div
      className={`mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${tone}`}
    >
      <div className="space-y-1">
        <p className="font-semibold">{t('heading')}</p>
        {expired.length > 0 && (
          <p>
            {t.rich('expired', {
              platforms: expired.map((e) => PLATFORM_LABEL[e.platform] || e.platform).join(', '),
              b: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        )}
        {critical.length > 0 && (
          <p>
            {t('critical', {
              list: critical
                .map((e) =>
                  t('platformDays', {
                    name: PLATFORM_LABEL[e.platform] || e.platform,
                    days: e.daysRemaining ?? 0,
                  }),
                )
                .join(', '),
            })}
          </p>
        )}
        {warn.length > 0 && (
          <p>
            {t('warn', {
              list: warn
                .map((e) =>
                  t('platformDays', {
                    name: PLATFORM_LABEL[e.platform] || e.platform,
                    days: e.daysRemaining ?? 0,
                  }),
                )
                .join(', '),
            })}
          </p>
        )}
        <Link
          href="/admin/marketplaces?tab=settings"
          className="inline-block underline decoration-dotted hover:opacity-70"
        >
          {t('updateTokens')}
        </Link>
      </div>
      <button
        onClick={dismiss}
        className="rounded p-1 text-xs hover:bg-white/40"
        aria-label={t('dismiss')}
        title={t('dismiss')}
      >
        ✕
      </button>
    </div>
  );
}
