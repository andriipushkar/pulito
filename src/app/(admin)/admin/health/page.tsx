'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';

interface SentryIssue {
  id: string;
  title: string;
  culprit: string | null;
  count: string;
  userCount: number;
  level: string;
  status: string;
  lastSeen: string;
  permalink: string;
}

interface SlowQueryRow {
  query: string;
  calls: number;
  meanMs: number;
  totalMs: number;
  rows: number;
}

interface DeploymentEntry {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  subject: string;
}

interface HealthPayload {
  sentry: SentryIssue[];
  slowQueries: { rows: SlowQueryRow[]; available: boolean; hint?: string };
  deployments: DeploymentEntry[];
}

const LEVEL_COLORS: Record<string, string> = {
  error: 'bg-red-100 text-red-700 border-red-200',
  fatal: 'bg-red-100 text-red-700 border-red-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
};

function formatDate(s: string) {
  return new Date(s).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HealthPage() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<HealthPayload>('/api/v1/admin/health')
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setData(res.data);
        else toast.error(res.error || 'Не вдалося завантажити стан системи');
      })
      .catch(() => {
        if (!cancelled) toast.error('Не вдалося завантажити стан системи');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (!data) return <p>Помилка завантаження</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Стан системи</h1>

      {/* Sentry */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Топ помилок (Sentry, 24h)
        </h2>
        {data.sentry.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-sm text-[var(--color-text-secondary)]">
            Sentry не повертає помилок або не налаштований (SENTRY_ORG / SENTRY_PROJECT /
            SENTRY_API_TOKEN).
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="px-3 py-2 text-left font-medium">Рівень</th>
                  <th className="px-3 py-2 text-left font-medium">Помилка</th>
                  <th className="px-3 py-2 text-right font-medium">Випадків</th>
                  <th className="px-3 py-2 text-right font-medium">Користувачів</th>
                  <th className="px-3 py-2 text-left font-medium">Остання</th>
                </tr>
              </thead>
              <tbody>
                {data.sentry.map((i) => (
                  <tr key={i.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          LEVEL_COLORS[i.level] ?? 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                      >
                        {i.level}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <a
                        href={i.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-primary)] hover:underline"
                      >
                        {i.title}
                      </a>
                      {i.culprit && (
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                          {i.culprit}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{i.count}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{i.userCount}</td>
                    <td className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                      {formatDate(i.lastSeen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Slow queries */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Повільні запити (pg_stat_statements)
        </h2>
        {!data.slowQueries.available ? (
          <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {data.slowQueries.hint}
          </div>
        ) : data.slowQueries.rows.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-sm text-[var(--color-text-secondary)]">
            Немає даних
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="px-3 py-2 text-right font-medium">сер., мс</th>
                  <th className="px-3 py-2 text-right font-medium">всього, мс</th>
                  <th className="px-3 py-2 text-right font-medium">викликів</th>
                  <th className="px-3 py-2 text-left font-medium">Запит</th>
                </tr>
              </thead>
              <tbody>
                {data.slowQueries.rows.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-3 py-2 text-right font-bold tabular-nums">
                      {r.meanMs.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.totalMs.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.calls}</td>
                    <td className="px-3 py-2">
                      <code className="block whitespace-pre-wrap break-all text-[11px] text-[var(--color-text)]">
                        {r.query}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Deployments */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Останні коміти (deploy history)
        </h2>
        {data.deployments.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-sm text-[var(--color-text-secondary)]">
            git недоступний або це не git-checkout.
          </div>
        ) : (
          <ol className="space-y-2">
            {data.deployments.map((d) => (
              <li
                key={d.hash}
                className="flex flex-wrap items-baseline justify-between gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                <div className="flex items-baseline gap-3">
                  <code className="font-mono text-xs text-[var(--color-text-secondary)]">
                    {d.shortHash}
                  </code>
                  <span>{d.subject}</span>
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {d.author} · {formatDate(d.date)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
