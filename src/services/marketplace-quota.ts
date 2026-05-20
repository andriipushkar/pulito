import { prisma } from '@/lib/prisma';
import type { MarketplacePlatform } from '@/services/marketplace-health';

/**
 * Tracks the most recent X-RateLimit-Remaining / X-RateLimit-Limit headers
 * returned by each marketplace so the admin UI can show "you have N
 * requests left in the current bucket".
 *
 * Persisted in siteSetting (single row per platform) — survives restarts.
 * The in-memory tracker (marketplace-rate-limit.ts) is a different signal:
 * it counts *our* outbound calls. This one reflects the marketplace's view.
 */
const KEY = (platform: string) => `marketplace_quota_${platform}`;

export interface QuotaInfo {
  remaining: number | null;
  limit: number | null;
  resetAt: string | null;
  lastSeenAt: string | null;
}

export async function recordQuotaFromHeaders(
  platform: MarketplacePlatform,
  headers: Headers,
): Promise<void> {
  const remaining = parseHeaderInt(headers, ['x-ratelimit-remaining', 'ratelimit-remaining']);
  const limit = parseHeaderInt(headers, ['x-ratelimit-limit', 'ratelimit-limit']);
  const resetRaw = headers.get('x-ratelimit-reset') || headers.get('ratelimit-reset');
  if (remaining == null && limit == null && !resetRaw) return;

  let resetAt: string | null = null;
  if (resetRaw) {
    const asInt = Number(resetRaw);
    if (Number.isFinite(asInt)) {
      // Heuristic: < 10^10 means seconds-since-epoch; otherwise treat as ms.
      const ms = asInt < 1e10 ? asInt * 1000 : asInt;
      resetAt = new Date(ms).toISOString();
    } else {
      const parsed = Date.parse(resetRaw);
      if (!Number.isNaN(parsed)) resetAt = new Date(parsed).toISOString();
    }
  }

  const info: QuotaInfo = {
    remaining,
    limit,
    resetAt,
    lastSeenAt: new Date().toISOString(),
  };

  try {
    await prisma.siteSetting.upsert({
      where: { key: KEY(platform) },
      create: { key: KEY(platform), value: JSON.stringify(info) },
      update: { value: JSON.stringify(info) },
    });
  } catch {
    // Best-effort
  }
}

export async function getQuotaInfo(platform: MarketplacePlatform): Promise<QuotaInfo | null> {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY(platform) } });
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as QuotaInfo;
  } catch {
    return null;
  }
}

function parseHeaderInt(headers: Headers, names: string[]): number | null {
  for (const n of names) {
    const v = headers.get(n);
    if (v != null) {
      const i = parseInt(v, 10);
      if (Number.isFinite(i)) return i;
    }
  }
  return null;
}
