'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

type Provider = 'claude' | 'gemini' | 'rules';

interface SummaryResponse {
  text: string;
  provider: Provider;
}

const PROVIDER_BADGE_CLASS: Record<Provider, string> = {
  claude: 'bg-purple-100 text-purple-700',
  gemini: 'bg-blue-100 text-blue-700',
  rules: 'bg-gray-100 text-gray-700',
};

/**
 * Daily executive briefing for the shop owner. Pulls dashboard stats and
 * asks an LLM to summarize them as 3-5 Ukrainian sentences. The provider
 * choice is remembered in localStorage (shared with product/category gens).
 */
export default function AIDashboardSummary() {
  const t = useTranslations('admin.aiDashboardSummary');
  const PROVIDER_LABEL: Record<Provider, string> = {
    claude: 'Claude',
    gemini: 'Gemini',
    rules: t('providerRules'),
  };
  const [text, setText] = useState<string | null>(null);
  // Which provider the server actually used (driven by the site-wide setting).
  const [usedProvider, setUsedProvider] = useState<Provider | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);

  const generate = useCallback(
    async (force = false) => {
      setIsLoading(true);
      try {
        // Provider is chosen globally in Settings; no per-action override.
        // Mount loads accept the server's 30-min cache; the refresh button
        // forces a fresh LLM generation.
        const res = await apiClient.post<SummaryResponse>('/api/v1/admin/dashboard/ai-summary', {
          force,
        });
        if (res.success && res.data) {
          setText(res.data.text);
          setUsedProvider(res.data.provider);
          setLastGeneratedAt(new Date());
        } else {
          toast.error(res.error || t('generateFailed'));
        }
      } catch {
        toast.error(t('networkError'));
      } finally {
        setIsLoading(false);
      }
    },
    [t],
  );

  // Auto-generate on mount once. User refresh via button.
  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-primary)]/5 to-[var(--color-primary)]/0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold">{t('title')}</h3>
            <p className="text-[11px] text-[var(--color-text-secondary)]">{t('subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => generate(true)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {t('generating')}
              </>
            ) : (
              <>{t('refresh')}</>
            )}
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {!text && isLoading && (
          <div className="space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--color-border)]" />
            <div className="h-3 w-full animate-pulse rounded bg-[var(--color-border)]" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-[var(--color-border)]" />
          </div>
        )}
        {text && (
          <>
            <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-text)]">
              {text}
            </p>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
              {usedProvider && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PROVIDER_BADGE_CLASS[usedProvider]}`}
                >
                  {PROVIDER_LABEL[usedProvider]}
                </span>
              )}
              {lastGeneratedAt && (
                <span>
                  {t('generatedAt', {
                    time: lastGeneratedAt.toLocaleTimeString('uk-UA', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  })}
                </span>
              )}
            </div>
          </>
        )}
        {!text && !isLoading && (
          <p className="text-sm text-[var(--color-text-secondary)]">{t('empty')}</p>
        )}
      </div>
    </div>
  );
}
