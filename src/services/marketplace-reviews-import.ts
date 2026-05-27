import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getChannelConfig } from '@/services/channel-config';

interface ExternalReview {
  externalId: string;
  authorName: string;
  rating: number;
  title?: string;
  comment?: string;
  pros?: string;
  cons?: string;
  reviewedAt: Date;
  externalListingId?: string;
  permalink?: string;
}

interface ImportSummary {
  fetched: number;
  upserted: number;
  matched: number;
  errors: number;
}

/**
 * Pull recent reviews from Rozetka and Prom seller APIs and upsert into
 * `MarketplaceReview` keyed by (platform, externalId). Each review is matched
 * to a local Product via `externalListingId` → MarketplaceListing → productId;
 * if no match, the review is kept but `productId` is left NULL so a manager
 * can reconcile manually.
 */
export async function importMarketplaceReviews(): Promise<{
  rozetka: ImportSummary;
  prom: ImportSummary;
}> {
  return {
    rozetka: await importFromPlatform('rozetka', fetchRozetkaReviews),
    prom: await importFromPlatform('prom', fetchPromReviews),
  };
}

async function importFromPlatform(
  platform: 'rozetka' | 'prom',
  fetcher: (cfg: Record<string, unknown>) => Promise<ExternalReview[]>,
): Promise<ImportSummary> {
  const summary: ImportSummary = { fetched: 0, upserted: 0, matched: 0, errors: 0 };

  const cfg = await getChannelConfig(platform);
  if (!cfg || !cfg.enabled) {
    logger.info(`[reviews-import] ${platform} disabled, skipping`);
    return summary;
  }

  let reviews: ExternalReview[] = [];
  try {
    reviews = await fetcher(cfg as unknown as Record<string, unknown>);
  } catch (err) {
    logger.error(`[reviews-import] ${platform} fetch failed`, { error: String(err) });
    summary.errors++;
    return summary;
  }

  summary.fetched = reviews.length;
  if (reviews.length === 0) return summary;

  // Map external listing IDs → local productId in one query (rather than N+1).
  const listingIds = reviews.map((r) => r.externalListingId).filter((v): v is string => Boolean(v));
  const listings = listingIds.length
    ? await prisma.marketplaceListing.findMany({
        where: { externalId: { in: listingIds }, connection: { platform } },
        select: { externalId: true, productId: true },
      })
    : [];
  const listingMap = new Map(listings.map((l) => [l.externalId!, l.productId]));

  for (const r of reviews) {
    const productId = r.externalListingId ? (listingMap.get(r.externalListingId) ?? null) : null;
    if (productId) summary.matched++;
    try {
      await prisma.marketplaceReview.upsert({
        where: {
          platform_externalId: { platform, externalId: r.externalId },
        },
        update: {
          authorName: r.authorName,
          rating: r.rating,
          title: r.title ?? null,
          comment: r.comment ?? null,
          pros: r.pros ?? null,
          cons: r.cons ?? null,
          reviewedAt: r.reviewedAt,
          externalListingId: r.externalListingId ?? null,
          permalink: r.permalink ?? null,
          productId,
        },
        create: {
          platform,
          externalId: r.externalId,
          authorName: r.authorName,
          rating: r.rating,
          title: r.title ?? null,
          comment: r.comment ?? null,
          pros: r.pros ?? null,
          cons: r.cons ?? null,
          reviewedAt: r.reviewedAt,
          externalListingId: r.externalListingId ?? null,
          permalink: r.permalink ?? null,
          productId,
        },
      });
      summary.upserted++;
    } catch (err) {
      logger.warn(`[reviews-import] ${platform} upsert failed`, {
        externalId: r.externalId,
        error: String(err),
      });
      summary.errors++;
    }
  }

  return summary;
}

interface RozetkaCommentItem {
  id: number | string;
  item_id?: number | string;
  user_name?: string;
  mark?: number;
  title?: string;
  text?: string;
  dignity?: string;
  shortcomings?: string;
  created?: string;
}

async function fetchRozetkaReviews(cfg: Record<string, unknown>): Promise<ExternalReview[]> {
  const apiKey = String(cfg.apiKey ?? '').trim();
  if (!apiKey) return [];

  const baseUrl = 'https://api-seller.rozetka.com.ua/';

  const authRes = await fetch(`${baseUrl}sites`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: apiKey, password: apiKey }),
    signal: AbortSignal.timeout(15000),
  });
  const authData = (await authRes.json()) as { content?: { token?: string } };
  const token = authData.content?.token;
  if (!token) return [];

  const res = await fetch(`${baseUrl}comments?status=approved&per_page=100`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { content?: { items?: RozetkaCommentItem[] } };
  const items = data.content?.items ?? [];

  return items.map((c) => ({
    externalId: String(c.id),
    externalListingId: c.item_id != null ? String(c.item_id) : undefined,
    authorName: c.user_name?.trim() || 'Покупець Rozetka',
    rating: Math.max(1, Math.min(5, Number(c.mark) || 5)),
    title: c.title?.trim() || undefined,
    comment: c.text?.trim() || undefined,
    pros: c.dignity?.trim() || undefined,
    cons: c.shortcomings?.trim() || undefined,
    reviewedAt: c.created ? new Date(c.created) : new Date(),
  }));
}

interface PromOpinion {
  id: number | string;
  product_id?: number | string;
  author?: string;
  rating?: number;
  date_created?: string;
  text?: string;
  pluses?: string;
  minuses?: string;
}

async function fetchPromReviews(cfg: Record<string, unknown>): Promise<ExternalReview[]> {
  const apiToken = String(cfg.apiToken ?? '').trim();
  if (!apiToken) return [];

  const res = await fetch('https://my.prom.ua/api/v1/opinions/list?limit=100', {
    headers: { Authorization: `Bearer ${apiToken}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { opinions?: PromOpinion[] };
  const opinions = data.opinions ?? [];

  return opinions.map((o) => ({
    externalId: String(o.id),
    externalListingId: o.product_id != null ? String(o.product_id) : undefined,
    authorName: o.author?.trim() || 'Покупець Prom.ua',
    rating: Math.max(1, Math.min(5, Number(o.rating) || 5)),
    comment: o.text?.trim() || undefined,
    pros: o.pluses?.trim() || undefined,
    cons: o.minuses?.trim() || undefined,
    reviewedAt: o.date_created ? new Date(o.date_created) : new Date(),
  }));
}
