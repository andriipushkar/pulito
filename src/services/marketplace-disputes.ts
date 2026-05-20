import { getChannelConfig, type MarketplaceConfig } from '@/services/channel-config';
import { recordMarketplaceCall } from '@/services/marketplace-rate-limit';
import { marketplaceLogger } from '@/services/marketplace-logger';
import type { MarketplacePlatform } from '@/services/marketplace-health';

const log = marketplaceLogger('disputes');

export interface NormalizedDispute {
  platform: MarketplacePlatform;
  externalId: string;
  orderExternalId?: string;
  status: 'open' | 'in_review' | 'resolved_buyer' | 'resolved_seller' | 'closed';
  reason?: string;
  amount?: number;
  buyerMessage?: string;
  createdAt: string;
  updatedAt?: string;
  deadlineAt?: string;
}

function mapStatus(raw: string): NormalizedDispute['status'] {
  const s = raw.toLowerCase();
  if (s.includes('open') || s.includes('new')) return 'open';
  if (s.includes('review') || s.includes('pending')) return 'in_review';
  if (s.includes('buyer') || s.includes('refund')) return 'resolved_buyer';
  if (s.includes('seller')) return 'resolved_seller';
  return 'closed';
}

async function getRozetkaDisputes(): Promise<NormalizedDispute[]> {
  const config = (await getChannelConfig('rozetka')) as MarketplaceConfig | null;
  if (!config?.apiKey) return [];
  try {
    recordMarketplaceCall('rozetka');
    const res = await fetch('https://api-seller.rozetka.com.ua/disputes?limit=100', {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { content?: Record<string, unknown>[] };
    return (data.content || []).map((d): NormalizedDispute => ({
      platform: 'rozetka',
      externalId: String(d.id),
      orderExternalId: d.order_id ? String(d.order_id) : undefined,
      status: mapStatus(String(d.status || 'open')),
      reason: d.reason ? String(d.reason) : undefined,
      amount: d.amount != null ? Number(d.amount) : undefined,
      buyerMessage: d.buyer_comment ? String(d.buyer_comment) : undefined,
      createdAt: String(d.created_at || new Date().toISOString()),
      updatedAt: d.updated_at ? String(d.updated_at) : undefined,
      deadlineAt: d.deadline ? String(d.deadline) : undefined,
    }));
  } catch (err) {
    log.error('Rozetka disputes error', { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

async function getOlxDisputes(): Promise<NormalizedDispute[]> {
  const config = (await getChannelConfig('olx')) as MarketplaceConfig | null;
  if (!config?.accessToken) return [];
  try {
    recordMarketplaceCall('olx');
    const res = await fetch('https://www.olx.ua/api/partner/complaints?limit=100', {
      headers: { Authorization: `Bearer ${config.accessToken}`, Version: '2.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Record<string, unknown>[] };
    return (data.data || []).map((d): NormalizedDispute => ({
      platform: 'olx',
      externalId: String(d.id),
      orderExternalId: d.order_id ? String(d.order_id) : undefined,
      status: mapStatus(String(d.status || 'open')),
      reason: d.reason ? String(d.reason) : undefined,
      buyerMessage: d.message ? String(d.message) : undefined,
      createdAt: String(d.created_at || new Date().toISOString()),
      deadlineAt: d.response_deadline ? String(d.response_deadline) : undefined,
    }));
  } catch (err) {
    log.error('OLX disputes error', { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

export async function aggregateMarketplaceDisputes(): Promise<NormalizedDispute[]> {
  const [rozetka, olx] = await Promise.all([getRozetkaDisputes(), getOlxDisputes()]);
  return [...rozetka, ...olx].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
