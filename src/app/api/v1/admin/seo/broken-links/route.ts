import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkBrokenLinks, type BrokenLinkReport } from '@/services/jobs/broken-link-checker';
import { logger } from '@/lib/logger';

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

export const GET = withRole('admin', 'manager')(async () => {
  try {
    const [live, savedRow, historyRow] = await Promise.all([
      checkBrokenLinks(),
      prisma.siteSetting.findUnique({ where: { key: 'seo_check_results' } }),
      prisma.siteSetting.findUnique({ where: { key: 'seo_check_history' } }),
    ]);

    let lastCronScan: AuditResponse['lastCronScan'] = null;
    if (savedRow?.value) {
      try {
        const parsed = JSON.parse(savedRow.value) as {
          checkedAt?: string;
          http?: { issues?: HttpIssue[]; productsSampled?: number; categoriesChecked?: number };
          canonical?: { issues?: CanonicalIssue[]; sampled?: number };
          sitemap?: SitemapAudit;
        };
        if (parsed.http && parsed.checkedAt) {
          lastCronScan = {
            checkedAt: parsed.checkedAt,
            httpIssues: parsed.http.issues ?? [],
            canonicalIssues: parsed.canonical?.issues ?? [],
            sitemap: parsed.sitemap ?? null,
            productsSampled: parsed.http.productsSampled ?? 0,
            categoriesChecked: parsed.http.categoriesChecked ?? 0,
            canonicalSampled: parsed.canonical?.sampled ?? 0,
          };
        }
      } catch {
        // Stored value is stale/invalid — treat as "no cron scan available".
      }
    }

    let history: HistorySnapshot[] = [];
    if (historyRow?.value) {
      try {
        const parsed = JSON.parse(historyRow.value) as unknown;
        if (Array.isArray(parsed)) history = parsed as HistorySnapshot[];
      } catch {
        // ignore
      }
    }

    return successResponse<AuditResponse>({ live, lastCronScan, history });
  } catch (err) {
    logger.error('[admin/seo/broken-links] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
