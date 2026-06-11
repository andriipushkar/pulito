'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
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

function editLinkForGap(g: { id: number; type: 'product' | 'category' }): string {
  return g.type === 'product' ? `/admin/products/${g.id}` : `/admin/categories?edit=${g.id}`;
}

export default function AdminSeoAuditPage() {
  const t = useTranslations('admin.seoAuditPage');
  const WARNING_LABEL: Record<string, string> = {
    title_too_short: t('warn_title_too_short'),
    title_too_long: t('warn_title_too_long'),
    desc_too_short: t('warn_desc_too_short'),
    desc_too_long: t('warn_desc_too_long'),
  };
  const IMAGE_ISSUE_LABEL: Record<ImageGap['issue'], string> = {
    no_images: t('img_no_images'),
    no_main_image: t('img_no_main_image'),
    missing_alt_text: t('img_missing_alt_text'),
  };
  const SLUG_REASON_LABEL: Record<string, string> = {
    uppercase: t('slug_uppercase'),
    non_ascii: t('slug_non_ascii'),
    special_chars: t('slug_special_chars'),
    too_long: t('slug_too_long'),
    leading_or_trailing_dash: t('slug_leading_or_trailing_dash'),
  };
  const CANONICAL_PROBLEM_LABEL: Record<CanonicalIssue['problem'], string> = {
    missing: t('canon_missing'),
    mismatch: t('canon_mismatch'),
    fetch_failed: t('canon_fetch_failed'),
  };
  const [report, setReport] = useState<AuditResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (manual = false) => {
      if (manual) setIsRefreshing(true);
      else setIsLoading(true);
      setError('');
      try {
        const res = await apiClient.get<AuditResponse>('/api/v1/admin/seo/broken-links');
        if (res.success && res.data) setReport(res.data);
        else setError(res.error || t('checkError'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [t],
  );

  useEffect(() => {
    load();
  }, [load]);

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
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <Button onClick={() => load(true)} isLoading={isRefreshing}>
          {t('refresh')}
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
              title={t('cardBrokenRedirects')}
              count={live.orphanedRedirects.length}
              color={live.orphanedRedirects.length > 0 ? 'red' : 'green'}
            />
            <SummaryCard
              title={t('cardRedirectChains')}
              count={live.redirectChains.length}
              color={live.redirectChains.length > 0 ? 'yellow' : 'green'}
            />
            <SummaryCard
              title={t('cardNoSeo')}
              count={live.seoGapsTotal}
              color={live.seoGapsTotal > 0 ? 'yellow' : 'green'}
            />
            <SummaryCard
              title={t('cardDuplicateTitles')}
              count={live.duplicateTitles.length}
              color={live.duplicateTitles.length > 0 ? 'yellow' : 'green'}
            />
            <SummaryCard
              title={t('cardImageIssues')}
              count={live.imageGapsTotal}
              color={live.imageGapsTotal > 0 ? 'yellow' : 'green'}
            />
            <SummaryCard
              title={t('cardThinContent')}
              count={live.thinContentTotal}
              color={live.thinContentTotal > 0 ? 'yellow' : 'green'}
            />
            <SummaryCard
              title={t('cardBadSlugs')}
              count={live.slugIssuesTotal}
              color={live.slugIssuesTotal > 0 ? 'yellow' : 'green'}
            />
            {report?.lastCronScan?.canonicalIssues && (
              <SummaryCard
                title={t('cardCanonical')}
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
              <span className="text-3xl" aria-hidden="true">
                ✅
              </span>
              <p className="text-base font-semibold">{t('noIssuesTitle')}</p>
              <p className="text-xs">{t('noIssuesDesc')}</p>
            </div>
          )}

          {live.orphanedRedirects.length > 0 && (
            <Section title={t('cardBrokenRedirects')} description={t('brokenRedirectsDesc')}>
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">{t('thOldSlug')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('thNewSlugMissing')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('thType')}</th>
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
            <Section title={t('cardRedirectChains')} description={t('redirectChainsDesc')}>
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">{t('thPath')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('thHops')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('thType')}</th>
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
              title={t('cardNoSeo')}
              description={t('noSeoDesc', { shown: live.seoGaps.length, total: live.seoGapsTotal })}
            >
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">{t('thName')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('thType')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('thIssues')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('thAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {live.seoGaps.map((g) => {
                    const issues: string[] = [];
                    if (g.missingTitle) issues.push(t('noTitle'));
                    else issues.push(t('titleChars', { n: g.titleLength }));
                    if (g.missingDescription) issues.push(t('noDescription'));
                    else issues.push(t('descChars', { n: g.descLength }));
                    for (const w of g.warnings) issues.push(WARNING_LABEL[w] ?? w);
                    return (
                      <tr
                        key={`${g.type}-${g.id}`}
                        className="border-t border-[var(--color-border)]"
                      >
                        <td className="px-4 py-2 text-xs">{g.name}</td>
                        <td className="px-4 py-2 text-xs">
                          {g.type === 'product' ? t('typeProduct') : t('typeCategory')}
                        </td>
                        <td className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">
                          {issues.join(' · ')}
                        </td>
                        <td className="px-4 py-2">
                          <Link
                            href={editLinkForGap(g)}
                            className="text-xs text-[var(--color-primary)] hover:underline"
                          >
                            {t('edit')}
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
              title={t('cardImageIssues')}
              description={t('imageIssuesDesc', {
                shown: live.imageGaps.length,
                total: live.imageGapsTotal,
              })}
            >
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">{t('thProduct')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('thProblem')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('thAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {live.imageGaps.map((g) => (
                    <tr key={g.id} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-2 text-xs">{g.name}</td>
                      <td className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">
                        {IMAGE_ISSUE_LABEL[g.issue]}
                        {g.issue === 'missing_alt_text' &&
                          ` ${t('altCount', { n: g.imagesWithoutAlt })}`}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/admin/products/${g.id}`}
                          className="text-xs text-[var(--color-primary)] hover:underline"
                        >
                          {t('edit')}
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
              title={t('cardThinContent')}
              description={t('thinContentDesc', {
                shown: live.thinContent.length,
                total: live.thinContentTotal,
              })}
            >
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">{t('thProduct')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('thChars')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('thAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {live.thinContent.map((item) => (
                    <tr key={item.id} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-2 text-xs">{item.name}</td>
                      <td className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">
                        {item.charCount}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/admin/products/${item.id}`}
                          className="text-xs text-[var(--color-primary)] hover:underline"
                        >
                          {t('edit')}
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
              title={t('cardBadSlugs')}
              description={t('badSlugsDesc', {
                shown: live.slugIssues.length,
                total: live.slugIssuesTotal,
              })}
            >
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">{t('thName')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('thSlug')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('thIssues')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('thAction')}</th>
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
                          {t('edit')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {live.duplicateTitles.length > 0 && (
            <Section title={t('dupTitlesTitle')} description={t('dupTitlesDesc')}>
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">{t('thTitle')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('thCount')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('thExamples')}</th>
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
                title={t('lastHttpScan', {
                  date: new Date(report.lastCronScan.checkedAt).toLocaleString('uk-UA'),
                })}
                description={t('lastHttpScanDesc', {
                  products: report.lastCronScan.productsSampled,
                  categories: report.lastCronScan.categoriesChecked,
                })}
              >
                {report.lastCronScan.httpIssues.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-green-700">{t('allUrlsOk')}</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--color-bg-secondary)]">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">{t('thUrl')}</th>
                        <th className="px-4 py-2 text-left font-medium">{t('thStatus')}</th>
                        <th className="px-4 py-2 text-left font-medium">{t('thType')}</th>
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
                title={t('canonicalTitle')}
                description={t('canonicalDesc', { n: report.lastCronScan.canonicalSampled })}
              >
                {report.lastCronScan.canonicalIssues.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-green-700">{t('allCanonicalOk')}</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--color-bg-secondary)]">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">{t('thUrl')}</th>
                        <th className="px-4 py-2 text-left font-medium">{t('thProblem')}</th>
                        <th className="px-4 py-2 text-left font-medium">{t('thFound')}</th>
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
                  title={t('sitemapTitle')}
                  description={
                    report.lastCronScan.sitemap.fetched
                      ? t('sitemapFetched', {
                          total: report.lastCronScan.sitemap.totalUrls,
                          dupes: report.lastCronScan.sitemap.duplicateUrls,
                        })
                      : t('sitemapFailed', {
                          status: report.lastCronScan.sitemap.status
                            ? ` (HTTP ${report.lastCronScan.sitemap.status})`
                            : '',
                        })
                  }
                >
                  <div className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                    {report.lastCronScan.sitemap.fetched
                      ? report.lastCronScan.sitemap.duplicateUrls === 0
                        ? t('sitemapNoDupes')
                        : t('sitemapDupes', { dupes: report.lastCronScan.sitemap.duplicateUrls })
                      : t('sitemapCheckRoute')}
                  </div>
                </Section>
              )}
            </>
          ) : (
            <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-xs text-[var(--color-text-secondary)]">
              {t('cronNotRun')}
            </div>
          )}
        </div>
      ) : (
        !error && (
          <div className="flex flex-col items-center gap-2 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] py-12 text-center text-[var(--color-text-secondary)]">
            <span className="text-3xl" aria-hidden="true">
              🔗
            </span>
            <p className="text-sm font-medium">{t('loadAuditFailed')}</p>
            <button
              onClick={() => load(true)}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              {t('tryAgain')}
            </button>
          </div>
        )
      )}
    </div>
  );
}

function HistoryTrend({ history }: { history: HistorySnapshot[] }) {
  const t = useTranslations('admin.seoAuditPage');
  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  if (!latest || !previous) return null;

  const metrics: { key: string; label: string }[] = [
    { key: 'orphanedRedirects', label: t('mOrphanedRedirects') },
    { key: 'redirectChains', label: t('mRedirectChains') },
    { key: 'seoGaps', label: t('mSeoGaps') },
    { key: 'duplicateTitles', label: t('mDuplicateTitles') },
    { key: 'imageGaps', label: t('mImageGaps') },
    { key: 'thinContent', label: t('mThinContent') },
    { key: 'slugIssues', label: t('mSlugIssues') },
    { key: 'httpIssues', label: t('mHttpIssues') },
    { key: 'canonicalIssues', label: t('mCanonicalIssues') },
  ];

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <h3 className="mb-1 font-semibold">{t('trendTitle')}</h3>
      <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
        {t('trendDesc', {
          date: new Date(previous.checkedAt).toLocaleString('uk-UA'),
          count: history.length,
        })}
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
