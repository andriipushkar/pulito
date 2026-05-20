import { env } from '@/config/env';
import { logger } from '@/lib/logger';

/**
 * Fetch top recent issues from Sentry. Returns empty array when not configured
 * — the admin health page still renders, it just won't show errors.
 */

export interface SentryIssue {
  id: string;
  title: string;
  culprit: string | null;
  count: string;
  userCount: number;
  level: string;
  status: string;
  firstSeen: string;
  lastSeen: string;
  permalink: string;
}

export async function fetchTopSentryIssues(limit = 10): Promise<SentryIssue[]> {
  const { SENTRY_ORG, SENTRY_PROJECT, SENTRY_API_TOKEN } = env;
  if (!SENTRY_ORG || !SENTRY_PROJECT || !SENTRY_API_TOKEN) {
    return [];
  }

  const url = `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?statsPeriod=24h&sort=freq&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${SENTRY_API_TOKEN}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      logger.warn('[sentry] issues fetch failed', { status: res.status });
      return [];
    }
    const raw = (await res.json()) as Array<{
      id: string;
      title: string;
      culprit: string | null;
      count: string;
      userCount: number;
      level: string;
      status: string;
      firstSeen: string;
      lastSeen: string;
      permalink: string;
    }>;
    return raw.map((i) => ({
      id: i.id,
      title: i.title,
      culprit: i.culprit ?? null,
      count: i.count,
      userCount: i.userCount,
      level: i.level,
      status: i.status,
      firstSeen: i.firstSeen,
      lastSeen: i.lastSeen,
      permalink: i.permalink,
    }));
  } catch (err) {
    logger.warn('[sentry] fetch error', { error: String(err) });
    return [];
  }
}
