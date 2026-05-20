import { getChannelConfig, type MarketplaceConfig } from '@/services/channel-config';
import { recordMarketplaceCall } from '@/services/marketplace-rate-limit';
import type { MarketplacePlatform } from '@/services/marketplace-health';
import { marketplaceLogger } from '@/services/marketplace-logger';

const log = marketplaceLogger('reviews');

export interface NormalizedReview {
  platform: MarketplacePlatform;
  externalId: string;
  rating: number; // 1–5
  author: string;
  text: string;
  createdAt: string;
  productExternalId?: string;
  productName?: string;
  isResponded?: boolean;
}

async function getRozetkaReviews(): Promise<NormalizedReview[]> {
  const config = (await getChannelConfig('rozetka')) as MarketplaceConfig | null;
  if (!config?.apiKey) return [];
  try {
    recordMarketplaceCall('rozetka');
    const res = await fetch('https://api-seller.rozetka.com.ua/comments?limit=100', {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      log.error('Rozetka reviews fetch failed', { httpStatus: res.status });
      return [];
    }
    const data = (await res.json()) as { content?: Record<string, unknown>[] };
    return (data.content || []).map((r): NormalizedReview => ({
      platform: 'rozetka',
      externalId: String(r.id),
      rating: Number(r.mark ?? r.rating ?? 0),
      author: String(r.user_name || 'Покупець Rozetka'),
      text: String(r.text || ''),
      createdAt: String(r.created_at || new Date().toISOString()),
      productExternalId: r.item_id ? String(r.item_id) : undefined,
      productName: r.item_name ? String(r.item_name) : undefined,
      isResponded: Boolean(r.seller_reply),
    }));
  } catch (err) {
    log.error('Rozetka reviews error', { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

async function getPromReviews(): Promise<NormalizedReview[]> {
  const config = (await getChannelConfig('prom')) as MarketplaceConfig | null;
  if (!config?.apiToken) return [];
  try {
    recordMarketplaceCall('prom');
    const res = await fetch('https://my.prom.ua/api/v1/comments/list', {
      headers: { Authorization: `Bearer ${config.apiToken}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      log.error('Prom reviews fetch failed', { httpStatus: res.status });
      return [];
    }
    const data = (await res.json()) as { comments?: Record<string, unknown>[] };
    return (data.comments || []).map((c): NormalizedReview => ({
      platform: 'prom',
      externalId: String(c.id),
      rating: Number(c.rating ?? 0),
      author: String((c.user as Record<string, unknown>)?.name || 'Покупець Prom'),
      text: String(c.message || c.text || ''),
      createdAt: String(c.datetime || new Date().toISOString()),
      productExternalId: c.product_id ? String(c.product_id) : undefined,
      productName: c.product_name ? String(c.product_name) : undefined,
      isResponded: Boolean(c.reply),
    }));
  } catch (err) {
    log.error('Prom reviews error', { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

/**
 * Fetches reviews from every configured marketplace and returns them merged
 * and sorted newest-first. Best-effort: failures from one platform don't
 * block the others.
 */
export async function aggregateMarketplaceReviews(): Promise<NormalizedReview[]> {
  const [rozetka, prom] = await Promise.all([getRozetkaReviews(), getPromReviews()]);
  return [...rozetka, ...prom].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
