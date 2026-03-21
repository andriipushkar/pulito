import { getChannelConfig, type MarketplaceConfig } from '@/services/channel-config';

// ── Exponential Backoff for rate-limited APIs ──

async function withRetry<T>(
  fn: () => Promise<T>,
  { maxRetries = 3, baseDelayMs = 1000 }: { maxRetries?: number; baseDelayMs?: number } = {}
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Only retry on rate limits (429) or server errors (5xx)
      const isRetryable =
        err instanceof Error &&
        (err.message.includes('429') || err.message.includes('5'));
      if (!isRetryable || attempt === maxRetries) break;
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

/**
 * Wraps a fetch call with rate-limit awareness.
 * Throws on 429/5xx so withRetry can catch and back off.
 */
async function fetchWithRateLimit(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 429 || res.status >= 500) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res;
}

export interface MarketplaceListingData {
  title: string;
  description: string;
  price: number;
  currency?: string;
  images: string[];
  category?: string;
  productCode?: string;
  quantity?: number;
}

export interface MarketplaceResult {
  status: 'published' | 'failed';
  externalId?: string;
  permalink?: string;
  error?: string;
}

// ── OLX ──

export async function publishToOlx(data: MarketplaceListingData, appUrl: string): Promise<MarketplaceResult> {
  const config = await getChannelConfig('olx') as MarketplaceConfig | null;
  if (!config?.clientId || !config?.accessToken) {
    return { status: 'failed', error: 'OLX не налаштовано (потрібен Client ID та Access Token)' };
  }

  try {
    const imageUrls = data.images.map((img) => img.startsWith('http') ? img : `${appUrl}${img}`);

    const body = {
      title: data.title.slice(0, 70), // OLX limit
      description: data.description.slice(0, 9000),
      category_id: config.defaultCategoryId || '1',
      advertiser_type: 'business',
      contact: { name: config.contactName || 'Порошок', phone: config.contactPhone || '' },
      location: { city_id: config.cityId || '1' },
      params: [
        { key: 'price', value: { amount: Math.round(data.price * 100), currency: data.currency || 'UAH' } },
        { key: 'state', value: 'new' },
      ],
      images: imageUrls.slice(0, 8).map((url) => ({ url })),
    };

    const res = await fetch('https://www.olx.ua/api/partner/adverts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
        Version: '2.0',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    const result = await res.json();
    if (res.ok && result.data?.id) {
      return { status: 'published', externalId: String(result.data.id), permalink: result.data.url };
    }
    return { status: 'failed', error: result.error?.message || `HTTP ${res.status}` };
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : 'OLX API error' };
  }
}

// ── Rozetka (Seller API) ──

export async function publishToRozetka(data: MarketplaceListingData, appUrl: string): Promise<MarketplaceResult> {
  const config = await getChannelConfig('rozetka') as MarketplaceConfig | null;
  if (!config?.apiKey || !config?.sellerId) {
    return { status: 'failed', error: 'Rozetka не налаштовано (потрібен API Key та Seller ID)' };
  }

  try {
    const body = {
      name: data.title,
      name_ua: data.title,
      description: data.description,
      description_ua: data.description,
      price: data.price,
      old_price: 0,
      currency: 'UAH',
      article: data.productCode || '',
      quantity: data.quantity ?? 1,
      status: 'active',
      images: data.images.slice(0, 10).map((img) => ({
        url: img.startsWith('http') ? img : `${appUrl}${img}`,
      })),
    };

    const res = await fetch(`https://api-seller.rozetka.com.ua/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    const result = await res.json();
    if (res.ok && result.content?.id) {
      return { status: 'published', externalId: String(result.content.id), permalink: `https://rozetka.com.ua/ua/${result.content.id}/p${result.content.id}/` };
    }
    return { status: 'failed', error: result.errors?.[0]?.message || `HTTP ${res.status}` };
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : 'Rozetka API error' };
  }
}

// ── Prom.ua (API) ──

export async function publishToProm(data: MarketplaceListingData, appUrl: string): Promise<MarketplaceResult> {
  const config = await getChannelConfig('prom') as MarketplaceConfig | null;
  if (!config?.apiToken) {
    return { status: 'failed', error: 'Prom.ua не налаштовано (потрібен API Token)' };
  }

  try {
    const body = {
      name: data.title,
      description: data.description,
      price: data.price,
      currency: 'UAH',
      sku: data.productCode || '',
      quantity: data.quantity ?? 1,
      status: 'on_display',
      images: data.images.slice(0, 12).map((img) => ({
        url: img.startsWith('http') ? img : `${appUrl}${img}`,
      })),
    };

    const res = await fetch('https://my.prom.ua/api/v1/products/edit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    const result = await res.json();
    if (res.ok && (result.id || result.status === 'ok')) {
      const productId = result.id || '';
      return { status: 'published', externalId: String(productId), permalink: productId ? `https://prom.ua/p${productId}` : undefined };
    }
    return { status: 'failed', error: result.message || result.error || `HTTP ${res.status}` };
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : 'Prom.ua API error' };
  }
}

// ── Epicentr K (Marketplace API) ──

export async function publishToEpicentrk(data: MarketplaceListingData, appUrl: string): Promise<MarketplaceResult> {
  const config = await getChannelConfig('epicentrk') as MarketplaceConfig | null;
  if (!config?.apiKey || !config?.sellerId) {
    return { status: 'failed', error: 'Epicentr K не налаштовано (потрібен API Key та Seller ID)' };
  }

  try {
    const body = {
      name: data.title,
      description: data.description,
      price: data.price,
      currency: 'UAH',
      sku: data.productCode || '',
      stock: data.quantity ?? 1,
      seller_id: config.sellerId,
      images: data.images.slice(0, 10).map((img) => ({
        url: img.startsWith('http') ? img : `${appUrl}${img}`,
      })),
    };

    const res = await fetch('https://marketplace.epicentrk.ua/api/v1/products', {
      method: 'POST',
      headers: {
        'X-Api-Key': String(config.apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    const result = await res.json();
    if (res.ok && result.id) {
      return { status: 'published', externalId: String(result.id), permalink: `https://epicentrk.ua/p-${result.id}.html` };
    }
    return { status: 'failed', error: result.error?.message || result.message || `HTTP ${res.status}` };
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : 'Epicentr API error' };
  }
}

// ── Dispatcher ──

export async function publishToMarketplace(
  channel: string,
  data: MarketplaceListingData,
  appUrl: string
): Promise<MarketplaceResult> {
  switch (channel) {
    case 'olx': return publishToOlx(data, appUrl);
    case 'rozetka': return publishToRozetka(data, appUrl);
    case 'prom': return publishToProm(data, appUrl);
    case 'epicentrk': return publishToEpicentrk(data, appUrl);
    default: return { status: 'failed', error: `Невідомий маркетплейс: ${channel}` };
  }
}

// ── UPDATE listing ──

export async function updateMarketplaceListing(
  channel: string,
  externalId: string,
  data: Partial<MarketplaceListingData>,
  appUrl: string
): Promise<MarketplaceResult> {
  switch (channel) {
    case 'olx': {
      const config = await getChannelConfig('olx') as MarketplaceConfig | null;
      if (!config?.accessToken) return { status: 'failed', error: 'OLX не налаштовано' };
      const body: Record<string, unknown> = {};
      if (data.title) body.title = data.title.slice(0, 70);
      if (data.description) body.description = data.description.slice(0, 9000);
      if (data.price) body.params = [{ key: 'price', value: { amount: Math.round(data.price * 100), currency: 'UAH' } }];
      if (data.images?.length) body.images = data.images.slice(0, 8).map((url) => ({ url: url.startsWith('http') ? url : `${appUrl}${url}` }));
      const res = await fetchWithRateLimit(`https://www.olx.ua/api/partner/adverts/${externalId}`, {
        method: 'PUT', headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json', Version: '2.0' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
      });
      return res.ok ? { status: 'published', externalId } : { status: 'failed', error: `HTTP ${res.status}` };
    }
    case 'rozetka': {
      const config = await getChannelConfig('rozetka') as MarketplaceConfig | null;
      if (!config?.apiKey) return { status: 'failed', error: 'Rozetka не налаштовано' };
      const body: Record<string, unknown> = {};
      if (data.title) body.name = data.title;
      if (data.description) body.description = data.description;
      if (data.price) body.price = data.price;
      if (data.quantity !== undefined) body.quantity = data.quantity;
      const res = await fetchWithRateLimit(`https://api-seller.rozetka.com.ua/items/${externalId}`, {
        method: 'PUT', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
      });
      return res.ok ? { status: 'published', externalId } : { status: 'failed', error: `HTTP ${res.status}` };
    }
    case 'prom': {
      const config = await getChannelConfig('prom') as MarketplaceConfig | null;
      if (!config?.apiToken) return { status: 'failed', error: 'Prom.ua не налаштовано' };
      const body: Record<string, unknown> = { id: Number(externalId) };
      if (data.title) body.name = data.title;
      if (data.description) body.description = data.description;
      if (data.price) body.price = data.price;
      if (data.quantity !== undefined) body.quantity = data.quantity;
      const res = await fetchWithRateLimit('https://my.prom.ua/api/v1/products/edit', {
        method: 'POST', headers: { Authorization: `Bearer ${config.apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
      });
      return res.ok ? { status: 'published', externalId } : { status: 'failed', error: `HTTP ${res.status}` };
    }
    case 'epicentrk': {
      const config = await getChannelConfig('epicentrk') as MarketplaceConfig | null;
      if (!config?.apiKey) return { status: 'failed', error: 'Epicentr K не налаштовано' };
      const body: Record<string, unknown> = {};
      if (data.title) body.name = data.title;
      if (data.description) body.description = data.description;
      if (data.price) body.price = data.price;
      if (data.quantity !== undefined) body.stock = data.quantity;
      const res = await fetchWithRateLimit(`https://marketplace.epicentrk.ua/api/v1/products/${externalId}`, {
        method: 'PUT', headers: { 'X-Api-Key': String(config.apiKey), 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
      });
      return res.ok ? { status: 'published', externalId } : { status: 'failed', error: `HTTP ${res.status}` };
    }
    default: return { status: 'failed', error: `Невідомий маркетплейс: ${channel}` };
  }
}

// ── DELETE listing ──

export async function deleteMarketplaceListing(channel: string, externalId: string): Promise<MarketplaceResult> {
  switch (channel) {
    case 'olx': {
      const config = await getChannelConfig('olx') as MarketplaceConfig | null;
      if (!config?.accessToken) return { status: 'failed', error: 'OLX не налаштовано' };
      const res = await fetch(`https://www.olx.ua/api/partner/adverts/${externalId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${config.accessToken}`, Version: '2.0' },
        signal: AbortSignal.timeout(15000),
      });
      return res.ok || res.status === 404 ? { status: 'published' } : { status: 'failed', error: `HTTP ${res.status}` };
    }
    case 'rozetka': {
      const config = await getChannelConfig('rozetka') as MarketplaceConfig | null;
      if (!config?.apiKey) return { status: 'failed', error: 'Rozetka не налаштовано' };
      const res = await fetch(`https://api-seller.rozetka.com.ua/items/${externalId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(15000),
      });
      return res.ok || res.status === 404 ? { status: 'published' } : { status: 'failed', error: `HTTP ${res.status}` };
    }
    case 'prom': {
      const config = await getChannelConfig('prom') as MarketplaceConfig | null;
      if (!config?.apiToken) return { status: 'failed', error: 'Prom.ua не налаштовано' };
      const res = await fetch(`https://my.prom.ua/api/v1/products/edit`, {
        method: 'POST', headers: { Authorization: `Bearer ${config.apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(externalId), status: 'deleted' }),
        signal: AbortSignal.timeout(15000),
      });
      return res.ok ? { status: 'published' } : { status: 'failed', error: `HTTP ${res.status}` };
    }
    case 'epicentrk': {
      const config = await getChannelConfig('epicentrk') as MarketplaceConfig | null;
      if (!config?.apiKey) return { status: 'failed', error: 'Epicentr K не налаштовано' };
      const res = await fetch(`https://marketplace.epicentrk.ua/api/v1/products/${externalId}`, {
        method: 'DELETE', headers: { 'X-Api-Key': String(config.apiKey) },
        signal: AbortSignal.timeout(15000),
      });
      return res.ok || res.status === 404 ? { status: 'published' } : { status: 'failed', error: `HTTP ${res.status}` };
    }
    default: return { status: 'failed', error: `Невідомий маркетплейс: ${channel}` };
  }
}

// ── GET messages from marketplace ──

export interface MarketplaceMessage {
  id: string;
  marketplace: string;
  buyerName: string;
  text: string;
  listingTitle?: string;
  listingId: string;
  createdAt: string;
  isRead: boolean;
}

export async function getMarketplaceMessages(channel: string): Promise<MarketplaceMessage[]> {
  switch (channel) {
    case 'olx': {
      const config = await getChannelConfig('olx') as MarketplaceConfig | null;
      if (!config?.accessToken) return [];
      try {
        const res = await fetch('https://www.olx.ua/api/partner/threads', {
          headers: { Authorization: `Bearer ${config.accessToken}`, Version: '2.0' },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data || []).map((thread: Record<string, unknown>) => ({
          id: String(thread.id),
          marketplace: 'olx',
          buyerName: String((thread.interlocutor as Record<string, unknown>)?.name || 'Покупець'),
          text: String((thread.last_message as Record<string, unknown>)?.text || ''),
          listingTitle: String((thread.advert as Record<string, unknown>)?.title || ''),
          listingId: String((thread.advert as Record<string, unknown>)?.id || ''),
          createdAt: String(thread.created_at || new Date().toISOString()),
          isRead: (thread.unread_count as number) === 0,
        }));
      } catch { return []; }
    }
    case 'rozetka': {
      const config = await getChannelConfig('rozetka') as MarketplaceConfig | null;
      if (!config?.apiKey) return [];
      try {
        const res = await fetch('https://api-seller.rozetka.com.ua/orders/messages', {
          headers: { Authorization: `Bearer ${config.apiKey}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.content || []).map((msg: Record<string, unknown>) => ({
          id: String(msg.id),
          marketplace: 'rozetka',
          buyerName: String(msg.buyer_name || 'Покупець'),
          text: String(msg.body || ''),
          listingId: String(msg.item_id || ''),
          createdAt: String(msg.created || new Date().toISOString()),
          isRead: msg.is_read === true,
        }));
      } catch { return []; }
    }
    case 'prom': {
      const config = await getChannelConfig('prom') as MarketplaceConfig | null;
      if (!config?.apiToken) return [];
      try {
        const res = await fetch('https://my.prom.ua/api/v1/messages/list', {
          headers: { Authorization: `Bearer ${config.apiToken}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.messages || []).map((msg: Record<string, unknown>) => ({
          id: String(msg.id),
          marketplace: 'prom',
          buyerName: String((msg.user as Record<string, unknown>)?.name || 'Покупець'),
          text: String(msg.message || ''),
          listingId: String(msg.product_id || ''),
          createdAt: String(msg.datetime || new Date().toISOString()),
          isRead: msg.status === 'read',
        }));
      } catch { return []; }
    }
    default: return [];
  }
}

// ── Sync prices for all published products ──

export async function syncMarketplacePrices(
  channel: string,
  listings: { externalId: string; price: number; quantity: number }[],
  appUrl: string
): Promise<{ updated: number; failed: number }> {
  let updated = 0;
  let failed = 0;

  for (const listing of listings) {
    try {
      const result = await withRetry(
        () => updateMarketplaceListing(channel, listing.externalId, {
          price: listing.price,
          quantity: listing.quantity,
        }, appUrl),
        { maxRetries: 3, baseDelayMs: 1000 }
      );
      if (result.status === 'published') updated++;
      else failed++;
    } catch {
      failed++;
    }
  }

  return { updated, failed };
}

export const MARKETPLACE_CHANNELS = ['olx', 'rozetka', 'prom', 'epicentrk'] as const;
