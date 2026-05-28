'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { MARKETPLACES } from '../_shared';

/**
 * OnboardingWizard — empty-state shown above the tabs when ZERO marketplaces
 * are connected yet. Surfaces the 4 supported platforms as big cards with
 * docs links so a brand-new user knows where to click first.
 *
 * Hidden as soon as at least one marketplace returns a configured channel.
 */
export default function OnboardingWizard() {
  const t = useTranslations('admin.onboardingWizard');
  const tShared = useTranslations('admin.marketplacesShared');
  const [allEmpty, setAllEmpty] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<Array<{ platform: string; isActive: boolean }>>('/api/v1/admin/marketplaces')
      .then((res) => {
        if (res.success) {
          const list = Array.isArray(res.data) ? res.data : [];
          setAllEmpty(list.length === 0);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !allEmpty) return null;

  return (
    <div className="mb-6 rounded-2xl border-2 border-dashed border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 p-6">
      <div className="mb-5 text-center">
        <h3 className="text-lg font-bold">{t('title')}</h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('subtitle')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MARKETPLACES.map((m) => (
          <a
            key={m.key}
            href={`/admin/marketplaces?tab=settings#${m.key}`}
            className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 transition-all hover:scale-[1.02] hover:border-[var(--color-primary)] hover:shadow-md"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                {m.icon}
              </span>
              <span className="font-bold">{m.name}</span>
            </div>
            <p className="mb-3 line-clamp-2 text-xs text-[var(--color-text-secondary)]">
              {tShared(m.description)}
            </p>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--color-primary)]">{t('configure')}</span>
              <a
                href={m.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[var(--color-text-secondary)] hover:underline"
              >
                {t('docs')}
              </a>
            </div>
          </a>
        ))}
      </div>
      <p className="mt-5 text-center text-xs text-[var(--color-text-secondary)]">{t('freeNote')}</p>
    </div>
  );
}
