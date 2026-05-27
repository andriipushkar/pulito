'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';

interface SearchEntry {
  id: number;
  term: string;
  count: number;
  resultsCount: number;
  lastSearchedAt: string;
}

interface StatsResponse {
  zeroResult: SearchEntry[];
  top: SearchEntry[];
}

interface InsightsResponse {
  text: string;
  provider: string;
}

export default function SearchIntelPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [provider, setProvider] = useState<'claude' | 'gemini' | 'rules'>('gemini');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('pulito.aiProvider') : null;
    if (stored === 'claude' || stored === 'gemini' || stored === 'rules') setProvider(stored);
  }, []);

  useEffect(() => {
    apiClient
      .get<StatsResponse>('/api/v1/admin/search-intel')
      .then((res) => {
        if (res.success && res.data) setStats(res.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const generateInsights = async () => {
    setIsGenerating(true);
    try {
      const res = await apiClient.post<InsightsResponse>('/api/v1/admin/search-intel', {
        provider,
      });
      if (res.success && res.data) {
        setInsights(res.data);
      } else {
        toast.error(res.error || 'Не вдалося згенерувати');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold">Аналіз пошуку клієнтів</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Що люди шукають на сайті, особливо без результатів — це втрачені продажі.
        </p>
      </div>

      {/* AI Insights */}
      <div className="mb-6 rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-primary)]/5 to-transparent p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">AI-рекомендації</h3>
          <div className="flex items-center gap-2">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as 'claude' | 'gemini' | 'rules')}
              disabled={isGenerating}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs"
            >
              <option value="gemini">Gemini</option>
              <option value="claude">Claude</option>
              <option value="rules">Без AI</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={generateInsights}
              isLoading={isGenerating}
              disabled={!stats || stats.zeroResult.length === 0}
            >
              ✨ Згенерувати
            </Button>
          </div>
        </div>
        {insights ? (
          <p className="whitespace-pre-line text-sm leading-relaxed">{insights.text}</p>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Натисніть «Згенерувати» — AI проаналізує запити без результатів і запропонує конкретні
            дії (додати товар, синонім, категорію).
          </p>
        )}
      </div>

      {/* Two tables side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Zero-result */}
        <div className="rounded-2xl border border-red-200 bg-red-50/30">
          <div className="border-b border-red-200 p-4">
            <h3 className="font-semibold text-red-900">⚠ Без результатів</h3>
            <p className="mt-0.5 text-xs text-red-700">
              {stats?.zeroResult.length || 0} запитів — клієнти шукали, але не знайшли
            </p>
          </div>
          {stats && stats.zeroResult.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-red-100/50 text-xs text-red-800">
                <tr>
                  <th className="px-3 py-2 text-left">Запит</th>
                  <th className="px-3 py-2 text-right">Шукали</th>
                </tr>
              </thead>
              <tbody>
                {stats.zeroResult.map((q) => (
                  <tr key={q.id} className="border-t border-red-100">
                    <td className="px-3 py-2 font-medium">«{q.term}»</td>
                    <td className="px-3 py-2 text-right font-semibold">{q.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-4 text-center text-sm text-[var(--color-text-secondary)]">
              Поки немає запитів без результатів. Це добре!
            </p>
          )}
        </div>

        {/* All top */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]">
          <div className="border-b border-[var(--color-border)] p-4">
            <h3 className="font-semibold">Топ-запити (загалом)</h3>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {stats?.top.length || 0} найпопулярніших
            </p>
          </div>
          {stats && stats.top.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-3 py-2 text-left">Запит</th>
                  <th className="px-3 py-2 text-right">Шукали</th>
                  <th className="px-3 py-2 text-right">Результатів</th>
                </tr>
              </thead>
              <tbody>
                {stats.top.map((q) => (
                  <tr key={q.id} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2">«{q.term}»</td>
                    <td className="px-3 py-2 text-right font-semibold">{q.count}</td>
                    <td
                      className={`px-3 py-2 text-right text-xs ${
                        q.resultsCount === 0
                          ? 'text-red-600 font-semibold'
                          : 'text-[var(--color-text-secondary)]'
                      }`}
                    >
                      {q.resultsCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-4 text-center text-sm text-[var(--color-text-secondary)]">
              Поки немає даних — потрібно почекати, поки люди пошукають.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
