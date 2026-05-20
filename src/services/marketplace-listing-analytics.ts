import { prisma } from '@/lib/prisma';
import { getChannelConfig, type MarketplaceConfig } from '@/services/channel-config';
import { recordMarketplaceCall } from '@/services/marketplace-rate-limit';
import { marketplaceLogger } from '@/services/marketplace-logger';

const log = marketplaceLogger('listing-analytics');

interface ListingStats {
  externalId: string;
  views?: number;
  clicks?: number;
  conversionRate?: number;
}

async function fetchOlxStats(): Promise<ListingStats[]> {
  const config = (await getChannelConfig('olx')) as MarketplaceConfig | null;
  if (!config?.accessToken) return [];
  try {
    recordMarketplaceCall('olx');
    const res = await fetch('https://www.olx.ua/api/partner/adverts/stats?limit=500', {
      headers: { Authorization: `Bearer ${String(config.accessToken)}`, Version: '2.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Record<string, unknown>[] };
    return (data.data || []).map((r) => ({
      externalId: String(r.advert_id || r.id),
      views: r.views != null ? Number(r.views) : undefined,
      clicks: r.phone_views != null ? Number(r.phone_views) : undefined,
    }));
  } catch (err) {
    log.error('OLX stats fetch error', { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

async function fetchRozetkaStats(): Promise<ListingStats[]> {
  const config = (await getChannelConfig('rozetka')) as MarketplaceConfig | null;
  if (!config?.apiKey) return [];
  try {
    recordMarketplaceCall('rozetka');
    const res = await fetch('https://api-seller.rozetka.com.ua/items/stats?limit=500', {
      headers: { Authorization: `Bearer ${String(config.apiKey)}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { content?: Record<string, unknown>[] };
    return (data.content || []).map((r) => ({
      externalId: String(r.item_id || r.id),
      views: r.views != null ? Number(r.views) : undefined,
      clicks: r.clicks != null ? Number(r.clicks) : undefined,
    }));
  } catch (err) {
    log.error('Rozetka stats fetch error', { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

/**
 * Imports listing-level views/clicks from marketplaces that expose them
 * and stamps the numbers onto the corresponding PublicationChannel rows.
 */
export async function importListingAnalytics(): Promise<{
  updated: number;
  perPlatform: Record<string, number>;
}> {
  let updated = 0;
  const perPlatform: Record<string, number> = { olx: 0, rozetka: 0 };

  const platforms: { name: 'olx' | 'rozetka'; fetcher: () => Promise<ListingStats[]> }[] = [
    { name: 'olx', fetcher: fetchOlxStats },
    { name: 'rozetka', fetcher: fetchRozetkaStats },
  ];

  for (const { name, fetcher } of platforms) {
    const stats = await fetcher();
    for (const s of stats) {
      if (!s.externalId) continue;
      const data: Record<string, number> = {};
      if (s.views != null) data.views = s.views;
      if (s.clicks != null) data.clicks = s.clicks;
      if (s.views != null && s.clicks != null && s.views > 0) {
        data.engagement = +(s.clicks / s.views).toFixed(4);
      }
      if (Object.keys(data).length === 0) continue;
      const result = await prisma.publicationChannel.updateMany({
        where: { channel: name, externalId: s.externalId },
        data,
      });
      updated += result.count;
      perPlatform[name] += result.count;
    }
  }

  return { updated, perPlatform };
}
