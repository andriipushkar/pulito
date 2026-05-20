import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { runBrokenLinkChecker, type BrokenLinkReport } from '@/services/jobs/broken-link-checker';

const HEAD_SAMPLE_PRODUCTS = 50;
const HEAD_CONCURRENCY = 5;
const HEAD_TIMEOUT_MS = 5_000;
const CANONICAL_SAMPLE_PRODUCTS = 25;
const SITEMAP_FETCH_TIMEOUT_MS = 15_000;
// Cap history at ~3 months of daily runs so siteSetting blob stays small.
const HISTORY_KEEP = 90;

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
  counts: {
    orphanedRedirects: number;
    redirectChains: number;
    seoGaps: number;
    duplicateTitles: number;
    imageGaps: number;
    thinContent: number;
    slugIssues: number;
    httpIssues: number;
    canonicalIssues: number;
  };
}

interface SeoCheckResults {
  scan: BrokenLinkReport;
  http: {
    issues: HttpIssue[];
    productsSampled: number;
    categoriesChecked: number;
  };
  canonical: {
    issues: CanonicalIssue[];
    sampled: number;
  };
  sitemap: SitemapAudit;
  checkedAt: string;
}

async function headCheck(url: string, label: string): Promise<HttpIssue | null> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
    });
    if (res.status >= 400) {
      return {
        type: url.includes('/catalog?') ? 'broken_category' : 'broken_link',
        url,
        status: res.status,
        details: label,
      };
    }
    return null;
  } catch {
    return { type: 'unreachable', url, status: 0, details: label };
  }
}

async function runBatched<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  async function next(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++;
      const r = await worker(items[i]);
      if (r) results.push(r);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

async function canonicalCheck(url: string, expected: string): Promise<CanonicalIssue | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/html' },
      signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
    });
    if (res.status >= 400) {
      return { url, problem: 'fetch_failed', expected };
    }
    // Read just the <head> region. canonical lives there and downloading the
    // full HTML wastes bandwidth on product pages with long galleries.
    const reader = res.body?.getReader();
    if (!reader) return { url, problem: 'fetch_failed', expected };
    const decoder = new TextDecoder();
    let html = '';
    while (html.length < 16_384) {
      const { value, done } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (html.includes('</head>')) break;
    }
    reader.cancel().catch(() => {});
    const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    if (!match) return { url, problem: 'missing', expected };
    const found = match[1];
    if (found !== expected) return { url, problem: 'mismatch', expected, found };
    return null;
  } catch {
    return { url, problem: 'fetch_failed', expected };
  }
}

async function auditSitemap(sitemapUrl: string): Promise<SitemapAudit> {
  try {
    const res = await fetch(sitemapUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(SITEMAP_FETCH_TIMEOUT_MS),
    });
    if (res.status >= 400) {
      return { fetched: false, totalUrls: 0, duplicateUrls: 0, status: res.status };
    }
    const xml = await res.text();
    // Cheap regex-based extraction — Next.js emits <loc> per entry, full XML
    // parser would pull in a dependency for no real gain.
    const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].trim());
    const seen = new Map<string, number>();
    for (const loc of locs) seen.set(loc, (seen.get(loc) ?? 0) + 1);
    let duplicates = 0;
    for (const c of seen.values()) if (c > 1) duplicates++;
    return { fetched: true, totalUrls: locs.length, duplicateUrls: duplicates, status: res.status };
  } catch {
    return { fetched: false, totalUrls: 0, duplicateUrls: 0 };
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    // 1. DB-level scan + Telegram alert (the heavy SEO audit lives here).
    const scan = await runBrokenLinkChecker();

    // 2. HTTP-level smoke test: sample of products + all visible categories.
    // Use newest-first so freshly published items get checked while old ones
    // are covered over multiple runs (still a sample, but no permanent blind
    // spots).
    const appUrl = env.APP_URL;
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
      orderBy: { createdAt: 'desc' },
      take: HEAD_SAMPLE_PRODUCTS,
    });
    const categories = await prisma.category.findMany({
      where: { isVisible: true },
      select: { slug: true, name: true },
    });

    const productIssues = await runBatched<typeof products[number], HttpIssue>(
      products,
      HEAD_CONCURRENCY,
      (p) => headCheck(`${appUrl}/product/${p.slug}`, p.name),
    );
    const categoryIssues = await runBatched<typeof categories[number], HttpIssue>(
      categories,
      HEAD_CONCURRENCY,
      (c) => headCheck(`${appUrl}/catalog?category=${c.slug}`, c.name),
    );

    // 3. Canonical sample — random-ish slice of fresh products
    const canonicalSample = products.slice(0, CANONICAL_SAMPLE_PRODUCTS);
    const canonicalIssues = await runBatched<typeof canonicalSample[number], CanonicalIssue>(
      canonicalSample,
      HEAD_CONCURRENCY,
      (p) => {
        const url = `${appUrl}/product/${p.slug}`;
        return canonicalCheck(url, url);
      },
    );

    // 4. Sitemap audit
    const sitemap = await auditSitemap(`${appUrl}/sitemap.xml`);

    const results: SeoCheckResults = {
      scan,
      http: {
        issues: [...productIssues, ...categoryIssues],
        productsSampled: products.length,
        categoriesChecked: categories.length,
      },
      canonical: {
        issues: canonicalIssues,
        sampled: canonicalSample.length,
      },
      sitemap,
      checkedAt: new Date().toISOString(),
    };

    await prisma.siteSetting.upsert({
      where: { key: 'seo_check_results' },
      update: { value: JSON.stringify(results) },
      create: { key: 'seo_check_results', value: JSON.stringify(results) },
    });

    // 5. History snapshot — keep last HISTORY_KEEP runs in a rolling array
    const snapshot: HistorySnapshot = {
      checkedAt: results.checkedAt,
      counts: {
        orphanedRedirects: scan.orphanedRedirects.length,
        redirectChains: scan.redirectChains.length,
        seoGaps: scan.seoGapsTotal,
        duplicateTitles: scan.duplicateTitles.length,
        imageGaps: scan.imageGapsTotal,
        thinContent: scan.thinContentTotal,
        slugIssues: scan.slugIssuesTotal,
        httpIssues: results.http.issues.length,
        canonicalIssues: canonicalIssues.length,
      },
    };
    const existingHistoryRow = await prisma.siteSetting.findUnique({
      where: { key: 'seo_check_history' },
    });
    let history: HistorySnapshot[] = [];
    if (existingHistoryRow?.value) {
      try {
        const parsed = JSON.parse(existingHistoryRow.value) as unknown;
        if (Array.isArray(parsed)) history = parsed as HistorySnapshot[];
      } catch {
        // corrupt — start fresh
      }
    }
    history.push(snapshot);
    history = history.slice(-HISTORY_KEEP);
    await prisma.siteSetting.upsert({
      where: { key: 'seo_check_history' },
      update: { value: JSON.stringify(history) },
      create: { key: 'seo_check_history', value: JSON.stringify(history) },
    });

    return successResponse({
      orphanedRedirects: scan.orphanedRedirects.length,
      redirectChains: scan.redirectChains.length,
      seoGaps: scan.seoGapsTotal,
      duplicateTitles: scan.duplicateTitles.length,
      imageGaps: scan.imageGapsTotal,
      thinContent: scan.thinContentTotal,
      slugIssues: scan.slugIssuesTotal,
      httpIssues: results.http.issues.length,
      canonicalIssues: canonicalIssues.length,
      sitemap,
      productsSampled: products.length,
      categoriesChecked: categories.length,
    });
  } catch {
    return errorResponse('Помилка SEO перевірки', 500);
  }
}
