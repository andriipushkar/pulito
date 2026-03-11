'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

interface BrokenLinkReport {
  orphanedRedirects: { id: number; oldSlug: string; newSlug: string; type: string }[];
  redirectChains: { id: number; oldSlug: string; newSlug: string; type: string; finalSlug: string }[];
  seoGaps: { id: number; name: string; slug: string; type: 'product' | 'category' }[];
}

export default function AdminSeoAuditPage() {
  const [report, setReport] = useState<BrokenLinkReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const runCheck = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await apiClient.get<BrokenLinkReport>('/api/v1/admin/seo/broken-links');
      if (res.success && res.data) {
        setReport(res.data);
      } else {
        setError(res.error || 'Помилка перевірки');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const totalIssues = report
    ? report.orphanedRedirects.length + report.redirectChains.length + report.seoGaps.length
    : 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">SEO-аудит</h2>
        <Button onClick={runCheck} isLoading={isLoading}>
          {report ? 'Повторити перевірку' : 'Запустити перевірку'}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-[var(--radius)] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-12"><Spinner size="md" /></div>
      )}

      {report && !isLoading && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              title="Биті редіректи"
              count={report.orphanedRedirects.length}
              color={report.orphanedRedirects.length > 0 ? 'red' : 'green'}
            />
            <SummaryCard
              title="Ланцюги редіректів"
              count={report.redirectChains.length}
              color={report.redirectChains.length > 0 ? 'yellow' : 'green'}
            />
            <SummaryCard
              title="Без SEO-контенту"
              count={report.seoGaps.length}
              color={report.seoGaps.length > 0 ? 'yellow' : 'green'}
            />
          </div>

          {totalIssues === 0 && (
            <div className="rounded-[var(--radius)] border border-green-300 bg-green-50 px-4 py-6 text-center text-green-700">
              Проблем не знайдено!
            </div>
          )}

          {/* Orphaned Redirects */}
          {report.orphanedRedirects.length > 0 && (
            <Section title="Биті редіректи" description="Редіректи, де цільова сторінка не існує">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Старий slug</th>
                    <th className="px-4 py-2 text-left font-medium">Новий slug (не існує)</th>
                    <th className="px-4 py-2 text-left font-medium">Тип</th>
                  </tr>
                </thead>
                <tbody>
                  {report.orphanedRedirects.map((r) => (
                    <tr key={r.id} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-2 font-mono text-xs">{r.oldSlug}</td>
                      <td className="px-4 py-2 font-mono text-xs text-red-600">{r.newSlug}</td>
                      <td className="px-4 py-2 text-xs">{r.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Redirect Chains */}
          {report.redirectChains.length > 0 && (
            <Section title="Ланцюги редіректів" description="Редіректи, що ведуть на інший редірект">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Ланцюг</th>
                    <th className="px-4 py-2 text-left font-medium">Тип</th>
                  </tr>
                </thead>
                <tbody>
                  {report.redirectChains.map((r) => (
                    <tr key={r.id} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-2 font-mono text-xs">
                        {r.oldSlug} → {r.newSlug} → {r.finalSlug}
                      </td>
                      <td className="px-4 py-2 text-xs">{r.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* SEO Gaps */}
          {report.seoGaps.length > 0 && (
            <Section title="Без SEO-контенту" description="Товари та категорії без SEO-заголовка">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Назва</th>
                    <th className="px-4 py-2 text-left font-medium">Тип</th>
                    <th className="px-4 py-2 text-left font-medium">Дія</th>
                  </tr>
                </thead>
                <tbody>
                  {report.seoGaps.map((g) => (
                    <tr key={`${g.type}-${g.id}`} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-2 text-xs">{g.name}</td>
                      <td className="px-4 py-2 text-xs">{g.type === 'product' ? 'Товар' : 'Категорія'}</td>
                      <td className="px-4 py-2">
                        <Link
                          href={g.type === 'product' ? `/admin/products/${g.id}` : `/admin/categories`}
                          className="text-xs text-[var(--color-primary)] hover:underline"
                        >
                          Редагувати
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, count, color }: { title: string; count: number; color: 'red' | 'yellow' | 'green' }) {
  const colorMap = {
    red: 'border-red-300 bg-red-50 text-red-700',
    yellow: 'border-yellow-300 bg-yellow-50 text-yellow-700',
    green: 'border-green-300 bg-green-50 text-green-700',
  };

  return (
    <div className={`rounded-[var(--radius)] border px-4 py-3 ${colorMap[color]}`}>
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-sm">{title}</div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-[var(--color-text-secondary)]">{description}</p>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
