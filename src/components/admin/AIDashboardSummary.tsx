'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

type Provider = 'claude' | 'gemini' | 'rules';

interface SummaryResponse {
  text: string;
  provider: Provider;
}

const PROVIDER_LABEL: Record<Provider, string> = {
  claude: 'Claude',
  gemini: 'Gemini',
  rules: 'Шаблон',
};

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
  const [provider, setProvider] = useState<Provider>('gemini');
  const [text, setText] = useState<string | null>(null);
  const [usedProvider, setUsedProvider] = useState<Provider | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('pulito.aiProvider') : null;
    if (stored === 'claude' || stored === 'gemini' || stored === 'rules') setProvider(stored);
  }, []);

  const updateProvider = (v: Provider) => {
    setProvider(v);
    if (typeof window !== 'undefined') localStorage.setItem('pulito.aiProvider', v);
  };

  const generate = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.post<SummaryResponse>('/api/v1/admin/dashboard/ai-summary', {
        provider,
      });
      if (res.success && res.data) {
        setText(res.data.text);
        setUsedProvider(res.data.provider);
        setLastGeneratedAt(new Date());
      } else {
        toast.error(res.error || 'Не вдалося згенерувати брифінг');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

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
            <h3 className="text-sm font-semibold">Брифінг дня</h3>
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              AI-резюме поточного стану магазину
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={provider}
            onChange={(e) => updateProvider(e.target.value as Provider)}
            disabled={isLoading}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs"
            title="Виберіть джерело генерації"
          >
            <option value="gemini">Gemini (дешево)</option>
            <option value="claude">Claude (краще)</option>
            <option value="rules">Без AI (шаблон)</option>
          </select>
          <button
            type="button"
            onClick={generate}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Генеруємо…
              </>
            ) : (
              <>↻ Оновити</>
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
                  Згенеровано{' '}
                  {lastGeneratedAt.toLocaleTimeString('uk-UA', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          </>
        )}
        {!text && !isLoading && (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Натисніть «Оновити», щоб згенерувати брифінг дня.
          </p>
        )}
      </div>
    </div>
  );
}
