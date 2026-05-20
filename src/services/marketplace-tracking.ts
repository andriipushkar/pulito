import { prisma } from '@/lib/prisma';
import { getChannelConfig, type MarketplaceConfig } from '@/services/channel-config';
import { isMarketplacePlatform, type MarketplacePlatform } from '@/services/marketplace-health';
import { recordMarketplaceCall } from '@/services/marketplace-rate-limit';
import { marketplaceLogger } from '@/services/marketplace-logger';

const log = marketplaceLogger('tracking');

const DEFAULT_CARRIER = 'NovaPoshta';

export interface PushTrackingResult {
  success: boolean;
  error?: string;
  skipped?: 'not_marketplace' | 'no_external_id' | 'not_configured';
}

/**
 * Push a tracking number to the marketplace that created the order.
 * Marketplaces dock seller rating when shipments aren't reported, so this
 * is called every time `Order.trackingNumber` is set.
 *
 * Idempotent: calling twice with the same trackingNumber is harmless — the
 * marketplace either accepts the update or returns 409 (also treated as ok).
 */
export async function pushTrackingToMarketplace(
  orderId: number,
  trackingNumber: string,
  carrier: string = DEFAULT_CARRIER,
): Promise<PushTrackingResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, source: true, externalId: true, orderNumber: true },
  });
  if (!order) return { success: false, error: 'Замовлення не знайдено' };
  if (!order.source || !isMarketplacePlatform(order.source)) {
    return { success: false, skipped: 'not_marketplace' };
  }
  if (!order.externalId) {
    return { success: false, skipped: 'no_external_id' };
  }

  const platform = order.source as MarketplacePlatform;
  const config = (await getChannelConfig(platform)) as MarketplaceConfig | null;
  if (!config?.enabled) return { success: false, skipped: 'not_configured' };

  try {
    switch (platform) {
      case 'olx': {
        const token = typeof config.accessToken === 'string' ? config.accessToken : '';
        if (!token) return { success: false, error: 'OLX accessToken не вказано' };
        recordMarketplaceCall('olx');
        // OLX uses /partner/orders/{id}/fulfillment with operator + tracking_id
        const res = await fetch(
          `https://www.olx.ua/api/partner/orders/${encodeURIComponent(order.externalId)}/fulfillment`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Version: '2.0',
            },
            body: JSON.stringify({ operator: carrier, tracking_id: trackingNumber }),
            signal: AbortSignal.timeout(15000),
          },
        );
        return res.ok || res.status === 409
          ? { success: true }
          : { success: false, error: `HTTP ${res.status}` };
      }
      case 'rozetka': {
        const apiKey = typeof config.apiKey === 'string' ? config.apiKey : '';
        if (!apiKey) return { success: false, error: 'Rozetka apiKey не вказано' };
        recordMarketplaceCall('rozetka');
        const res = await fetch(
          `https://api-seller.rozetka.com.ua/orders/${encodeURIComponent(order.externalId)}/tracking`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tracking_number: trackingNumber,
              carrier,
            }),
            signal: AbortSignal.timeout(15000),
          },
        );
        return res.ok || res.status === 409
          ? { success: true }
          : { success: false, error: `HTTP ${res.status}` };
      }
      case 'prom': {
        const token = typeof config.apiToken === 'string' ? config.apiToken : '';
        if (!token) return { success: false, error: 'Prom apiToken не вказано' };
        recordMarketplaceCall('prom');
        const res = await fetch('https://my.prom.ua/api/v1/orders/set_status', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: [Number(order.externalId)],
            status: 'delivered_by_seller',
            cancellation_reason: null,
            cancellation_title: null,
            delivery_provider: carrier.toLowerCase(),
            declaration_number: trackingNumber,
          }),
          signal: AbortSignal.timeout(15000),
        });
        return res.ok || res.status === 409
          ? { success: true }
          : { success: false, error: `HTTP ${res.status}` };
      }
      case 'epicentrk': {
        const apiKey = typeof config.apiKey === 'string' ? config.apiKey : '';
        if (!apiKey) return { success: false, error: 'Epicentr apiKey не вказано' };
        recordMarketplaceCall('epicentrk');
        const res = await fetch(
          `https://marketplace.epicentrk.ua/api/v1/orders/${encodeURIComponent(order.externalId)}/ship`,
          {
            method: 'POST',
            headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tracking_number: trackingNumber,
              carrier,
            }),
            signal: AbortSignal.timeout(15000),
          },
        );
        return res.ok || res.status === 409
          ? { success: true }
          : { success: false, error: `HTTP ${res.status}` };
      }
      default:
        return { success: false, skipped: 'not_marketplace' };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('Push tracking failed', { platform, orderId: order.id, trackingNumber, error: message });
    return { success: false, error: message };
  }
}

/**
 * Wrapper that pushes tracking and logs without throwing. Caller can use this
 * inside an API handler without wrapping in try/catch.
 */
export async function pushTrackingSafe(
  orderId: number,
  trackingNumber: string,
): Promise<PushTrackingResult> {
  try {
    const result = await pushTrackingToMarketplace(orderId, trackingNumber);
    if (!result.success && !result.skipped) {
      log.warn('Tracking push failed (non-fatal)', {
        orderId,
        trackingNumber,
        error: result.error,
      });
    }
    return result;
  } catch (err) {
    log.error('Tracking push threw', {
      orderId,
      trackingNumber,
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: 'Внутрішня помилка' };
  }
}
