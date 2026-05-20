'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

interface OrphanedRedirect {
  id: number;
  oldSlug: string;
  newSlug: string;
  type: string;
}
interface RedirectChain {
  id: number;
  type: string;
  hops: string[];
  finalSlug: string;
}
interface SeoGap {
  id: number;
  name: string;
  slug: string;
  type: 'product' | 'category';
  missingTitle: boolean;
  missingDescription: boolean;
  titleLength: number;
  descLength: number;
  warnings: string[];
}
interface DuplicateSeoTitle {
  title: string;
  count: number;
  examples: { id: number; type: 'product' | 'category'; name: string; slug: string }[];
}
interface ImageGap {
  id: number;
  name: string;
  slug: string;
  issue: 'no_images' | 'no_main_image' | 'missing_alt_text';
  imagesWithoutAlt: number;
}
interface ThinContentItem {
  id: number;
  name: string;
  slug: string;
  charCount: number;
}
interface SlugIssueItem {
  id: number;
  name: string;
  slug: string;
  type: 'product' | 'category';
  reasons: string[];
}
interface BrokenLinkReport {
  orphanedRedirects: OrphanedRedirect[];
  redirectChains: RedirectChain[];
  seoGaps: SeoGap[];
  seoGapsTotal: number;
  duplicateTitles: DuplicateSeoTitle[];
  imageGaps: ImageGap[];
  imageGapsTotal: number;
  thinContent: ThinContentItem[];
  thinContentTotal: number;
  slugIssues: SlugIssueItem[];
  slugIssuesTotal: number;
  generatedAt: string;
}
interface HttpIssue {
  type: 'broken_link' | 'broken_category' | 'unreachable';
  url: string;
  status: number;
  details?: string;
}
interface CanonicalIssue {
  url: string;
  problem: 'missing' | 'mismatch' | 'fetch_failed';
  found?: string;
  expected: string;
}
interface SitemapAudit {
  fetched: boolean;
  totalUrls: number;
  duplicateUrls: number;
  status?: number;
}
interface HistorySnapshot {
  checkedAt: string;
  counts: Record<string, number>;
}
interface AuditResponse {
  live: BrokenLinkReport;
  lastCronScan: {
    checkedAt: string;
    httpIssues: HttpIssue[];
    canonicalIssues: CanonicalIssue[];
    sitemap: SitemapAudit | null;
    productsSampled: number;
    categoriesChecked: number;
    canonicalSampled: number;
  } | null;
  history: HistorySnapshot[];
}

const WARNING_LABEL: Record<string, string> = {
  title_too_short: 'title закороткий',
  title_too_long: 'title задовгий',
  desc_too_short: 'description закороткий',
  desc_too_long: 'description задовгий',
};

const IMAGE_ISSUE_LABEL: Record<ImageGap['issue'], string> = {
  no_images: 'немає зображень',
  no_main_image: 'не позначено головне',
  missing_alt_text: 'відсутній alt-текст',
};

const SLUG_REASON_LABEL: Record<string, string> = {
  uppercase: 'великі літери',
  non_ascii: 'не-ASCII (кирилиця)',
  special_chars: 'спецсимволи',
  too_long: 'задовгий',
  leading_or_trailing_dash: 'крайні/подвійні дефіси',
};

const CANONICAL_PROBLEM_LABEL: Record<CanonicalIssue['problem'], string> = {
  missing: 'відсутній canonical',
  mismatch: 'не співпадає',
  fetch_failed: 'не вдалось завантажити',
};

function editLinkForGap(g: { id: number; type: 'product' | 'category' }): string {
  return g.type === 'product' ? `/admin/products/${g.id}` : `/admin/categories?edit=${g.id}`;
}

export default function AdminSeoAuditPage() {
  const [report, setReport] = useState<AuditResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    else setIsLoading(true);
    setError('');
    try {
      const res = await apiClient.get<AuditResponse>('/api/v1/admin/seo/broken-links');
      if (res.success && res.data) setReport(res.data);
      else setError(res.error || 'Помилка перевірки');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const live = report?.live;
  const totalIssues = live
    ? live.orphanedRedirects.length +
      live.redirectChains.length +
      live.seoGapsTotal +
      live.duplicateTitles.length +
      live.imageGapsTotal +
      live.thinContentTotal +
      live.slugIssuesTotal
    : 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">SEO-аудит</h2>
        <Button onClick={() => load(true)} isLoading={isRefreshing}>
          Оновити
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-[var(--radius)] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : live ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="Биті редіректи"
              count={live.orphanedRedirects.length}
              color={live.orphanedRedirects.length > 0 ? 'red' : 'green'}
            />
            <SummaryCard
              title="Ланцюги редіректів"
              count={live.redirectChains.length}
              color={live.redirectChains.length > 0 ? 'yellow' : 'green'}
            />
            <SummaryCard
              title="Без SEO-контенту"
              count={live.seoGapsTotal}
              color={live.seoGapsTotal > 0 ? 'yellow' : 'green'}
            />
            <SummaryCard
              title="Дублікати title"
              count={live.duplicateTitles.length}
              color={live.duplicateTitles.length > 0 ? 'yellow' : 'green'}
            />
            <SummaryCard
              title="Проблеми із зображеннями"
              count={live.imageGapsTotal}
              color={live.imageGapsTotal > 0 ? 'yellow' : 'green'}
            />
            <SummaryCard
              title="Тонкий контент"
              count={live.thinContentTotal}
              color={live.thinContentTotal > 0 ? 'yellow' : 'green'}
            />
            <SummaryCard
              title="Погані slug'и"
              count={live.slugIssuesTotal}
              color={live.slugIssuesTotal > 0 ? 'yellow' : 'green'}
            />
            {report?.lastCronScan?.canonicalIssues && (
              <SummaryCard
                title="Canonical-проблеми"
                count={report.lastCronScan.canonicalIssues.length}
                color={report.lastCronScan.canonicalIssues.length > 0 ? 'red' : 'green'}
              />
            )}
          </div>

          {report?.history && report.history.length > 1 && (
            <HistoryTrend history={report.history} />
          )}

          {totalIssues === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-[var(--radius)] border border-green-300 bg-green-50 px-4 py-8 text-center text-green-700">
              <span className="text-3xl" aria-hidden="true">✅</span>
              <p className="text-base font-semibold">Проблем не знайдено</p>
              <p className="text-xs">Усі товари, категорії та редіректи в порядку</p>
            </div>
          )}

          {live.orphanedRedirects.length > 0 && (
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
                  {live.orphanedRedirects.map((r) => (
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

          {live.redirectChains.length > 0 && (
            <Section title="Ланцюги редіректів" description="Багатоланкові 301 (Google штрафує)">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Шлях</th>
                    <th className="px-4 py-2 text-left font-medium">Ланок</th>
                    <th className="px-4 py-2 text-left font-medium">Тип</th>
                  </tr>
                </thead>
                <tbody>
                  {live.redirectChains.map((r) => (
                    <tr key={r.id} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-2 font-mono text-xs">{r.hops.join(' → ')}</td>
                      <td className="px-4 py-2 text-xs">{r.hops.length - 1}</td>
                      <td className="px-4 py-2 text-xs">{r.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {live.seoGaps.length > 0 && (
            <Section
              title="Без SEO-контенту"
              description={`Товари та категорії з відсутнім або проблемним SEO. Показано ${live.seoGaps.length} з ${live.seoGapsTotal}`}
            >
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Назва</th>
                    <th className="px-4 py-2 text-left font-medium">Тип</th>
                    <th className="px-4 py-2 text-left font-medium">Проблеми</th>
                    <th className="px-4 py-2 text-left font-medium">Дія</th>
                  </tr>
                </thead>
                <tbody>
                  {live.seoGaps.map((g) => {
                    const issues: string[] = [];
                    if (g.missingTitle) issues.push('немає title');
                    else issues.push(`title: ${g.titleLength} симв`);
                    if (g.missingDescription) issues.push('немає description');
                    else issues.push(`desc: ${g.descLength} симв`);
                    for (const w of g.warnings) issues.push(WARNING_LABEL[w] ?? w);
                    return (
                      <tr key={`${g.type}-${g.id}`} className="border-t border-[var(--color-border)]">
                        <td className="px-4 py-2 text-xs">{g.name}</td>
                        <td className="px-4 py-2 text-xs">
                          {g.type === 'product' ? 'Товар' : 'Категорія'}
                        </td>
                        <td className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">
                          {issues.join(' · ')}
                        </td>
                        <td className="px-4 py-2">
                          <Link
                            href={editLinkForGap(g)}
                            className="text-xs text-[var(--color-primary)] hover:underline"
                          >
                            Редагувати
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>
          )}

          {live.imageGaps.length > 0 && (
            <Section
              title="Проблеми із зображеннями"
              description={`Товари без зображень, без головного фото або з відсутнім alt-текстом. Показано ${live.imageGaps.length} з ${live.imageGapsTotal}`}
            >
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Товар</th>
                    <th className="px-4 py-2 text-left font-medium">Проблема</th>
                    <th className="px-4 py-2 text-left font-medium">Дія</th>
                  </tr>
                </thead>
                <tbody>
                  {live.imageGaps.map((g) => (
                    <tr key={g.id} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-2 text-xs">{g.name}</td>
                      <td className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">
                        {IMAGE_ISSUE_LABEL[g.issue]}
                        {g.issue === 'missing_alt_text' && ` (${g.imagesWithoutAlt} шт)`}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/admin/products/${g.id}`}
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

          {live.thinContent.length > 0 && (
            <Section
              title="Тонкий контент"
              description={`Товари з описом коротше 200 символів. Показано ${live.thinContent.length} з ${live.thinContentTotal}`}
            >
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Товар</th>
                    <th className="px-4 py-2 text-left font-medium">Символів</th>
                    <th className="px-4 py-2 text-left font-medium">Дія</th>
                  </tr>
                </thead>
                <tbody>
                  {live.thinContent.map((t) => (
                    <tr key={t.id} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-2 text-xs">{t.name}</td>
                      <td className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">{t.charCount}</td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/admin/products/${t.id}`}
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

          {live.slugIssues.length > 0 && (
            <Section
              title="Погані slug'и"
              description={`URL-сегменти, що порушують норми (uppercase, кирилиця, спецсимволи, &gt;75 символів). Показано ${live.slugIssues.length} з ${live.slugIssuesTotal}`}
            >
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Назва</th>
                    <th className="px-4 py-2 text-left font-medium">Slug</th>
                    <th className="px-4 py-2 text-left font-medium">Проблеми</th>
                    <th className="px-4 py-2 text-left font-medium">Дія</th>
                  </tr>
                </thead>
                <tbody>
                  {live.slugIssues.map((s) => (
                    <tr key={`${s.type}-${s.id}`} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-2 text-xs">{s.name}</td>
                      <td className="px-4 py-2 font-mono text-xs">{s.slug}</td>
                      <td className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">
                        {s.reasons.map((r) => SLUG_REASON_LABEL[r] ?? r).join(' · ')}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={editLinkForGap(s)}
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

          {live.duplicateTitles.length > 0 && (
            <Section
              title="Дублікати SEO Title"
              description="Сторінки з ідентичним SEO-заголовком конкурують одна з одною в видачі"
            >
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Title</th>
                    <th className="px-4 py-2 text-left font-medium">Кількість</th>
                    <th className="px-4 py-2 text-left font-medium">Приклади</th>
                  </tr>
                </thead>
                <tbody>
                  {live.duplicateTitles.map((d) => (
                    <tr key={d.title} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-2 text-xs font-mono">{d.title}</td>
                      <td className="px-4 py-2 text-xs">{d.count}</td>
                      <td className="px-4 py-2 text-xs">
                        {d.examples.map((e, i) => (
                          <span key={`${e.type}-${e.id}`}>
                            {i > 0 && ', '}
                            <Link
                              href={
                                e.type === 'product'
                                  ? `/admin/products/${e.id}`
                                  : `/admin/categories?edit=${e.id}`
                              }
                              className="hover:underline"
                            >
                              {e.name}
                            </Link>
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {report?.lastCronScan ? (
            <>
              <Section
                title={`Останнє повне сканування (HTTP): ${new Date(report.lastCronScan.checkedAt).toLocaleString('uk-UA')}`}
                description={`Перевірено ${report.lastCronScan.productsSampled} товарів і ${report.lastCronScan.categoriesChecked} категорій через HEAD-запит`}
              >
                {report.lastCronScan.httpIssues.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-green-700">Усі URL відповіли успішно.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--color-bg-secondary)]">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">URL</th>
                        <th className="px-4 py-2 text-left font-medium">Статус</th>
                        <th className="px-4 py-2 text-left font-medium">Тип</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.lastCronScan.httpIssues.map((i) => (
                        <tr key={i.url} className="border-t border-[var(--color-border)]">
                          <td className="px-4 py-2 font-mono text-xs">{i.url}</td>
                          <td className="px-4 py-2 text-xs">{i.status || '—'}</td>
                          <td className="px-4 py-2 text-xs">{i.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>

              <Section
                title="Canonical URL"
                description={`Перевірено ${report.lastCronScan.canonicalSampled} товарів через GET — порівняння <link rel="canonical"> з очікуваним URL`}
              >
                {report.lastCronScan.canonicalIssues.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-green-700">Усі canonical коректні.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--color-bg-secondary)]">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">URL</th>
                        <th className="px-4 py-2 text-left font-medium">Проблема</th>
                        <th className="px-4 py-2 text-left font-medium">Знайдено</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.lastCronScan.canonicalIssues.map((i) => (
                        <tr key={i.url} className="border-t border-[var(--color-border)]">
                          <td className="px-4 py-2 font-mono text-xs">{i.url}</td>
                          <td className="px-4 py-2 text-xs">
                            {CANONICAL_PROBLEM_LABEL[i.problem] ?? i.problem}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-[var(--color-text-secondary)]">
                            {i.found ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>

              {report.lastCronScan.sitemap && (
                <Section
                  title="Sitemap.xml"
                  description={
                    report.lastCronScan.sitemap.fetched
                      ? `Знайдено ${report.lastCronScan.sitemap.totalUrls} URL, дублікатів: ${report.lastCronScan.sitemap.duplicateUrls}`
                      : `Не вдалось завантажити sitemap.xml${report.lastCronScan.sitemap.status ? ` (HTTP ${report.lastCronScan.sitemap.status})` : ''}`
                  }
                >
                  <div className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                    {report.lastCronScan.sitemap.fetched
                      ? report.lastCronScan.sitemap.duplicateUrls === 0
                        ? 'Дублікатів URL не знайдено.'
                        : `Виявлено ${report.lastCronScan.sitemap.duplicateUrls} дублікат(ів) — це знижує авторитет канонічних сторінок.`
                      : 'Перевірте маршрут /sitemap.xml — Google може не зчитати карту сайту.'}
                  </div>
                </Section>
              )}
            </>
          ) : (
            <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-xs text-[var(--color-text-secondary)]">
              HTTP-перевірка через cron ще не запускалась.
            </div>
          )}
        </div>
      ) : (
        !error && (
          <div className="flex flex-col items-center gap-2 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] py-12 text-center text-[var(--color-text-secondary)]">
            <span className="text-3xl" aria-hidden="true">🔗</span>
            <p className="text-sm font-medium">Не вдалося завантажити аудит</p>
            <button
              onClick={() => load(true)}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              Спробувати ще раз
            </button>
          </div>
        )
      )}
    </div>
  );
}

function HistoryTrend({ history }: { history: HistorySnapshot[] }) {
  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  if (!latest || !previous) return null;

  const metrics: { key: string; label: string }[] = [
    { key: 'orphanedRedirects', label: 'Биті редіректи' },
    { key: 'redirectChains', label: 'Ланцюги' },
    { key: 'seoGaps', label: 'SEO-gap' },
    { key: 'duplicateTitles', label: 'Дублікати' },
    { key: 'imageGaps', label: 'Зображення' },
    { key: 'thinContent', label: 'Тонкий контент' },
    { key: 'slugIssues', label: "Slug'и" },
    { key: 'httpIssues', label: 'HTTP' },
    { key: 'canonicalIssues', label: 'Canonical' },
  ];

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <h3 className="mb-1 font-semibold">Динаміка</h3>
      <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
        Порівняння з попереднім запуском ({new Date(previous.checkedAt).toLocaleString('uk-UA')}). Усього збережено{' '}
        {history.length} знімків.
      </p>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((m) => {
          const now = latest.counts[m.key] ?? 0;
          const before = previous.counts[m.key] ?? 0;
          const delta = now - before;
          const trendColor =
            delta < 0
              ? 'text-green-700'
              : delta > 0
                ? 'text-red-700'
                : 'text-[var(--color-text-secondary)]';
          const arrow = delta < 0 ? '↓' : delta > 0 ? '↑' : '·';
          return (
            <div
              key={m.key}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2"
            >
              <div className="text-xs text-[var(--color-text-secondary)]">{m.label}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold">{now}</span>
                <span className={`text-xs ${trendColor}`}>
                  {arrow} {Math.abs(delta) || ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  count,
  color,
}: {
  title: string;
  count: number;
  color: 'red' | 'yellow' | 'green';
}) {
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

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
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
