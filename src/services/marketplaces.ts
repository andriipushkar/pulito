import { getChannelConfig, type MarketplaceConfig } from '@/services/channel-config';
import { recordMarketplaceCall } from '@/services/marketplace-rate-limit';
import {
  withMarketplaceRetry as withRetry,
  fetchMarketplace as fetchWithRateLimit,
} from '@/services/marketplace-retry';
import { marketplaceLogger } from '@/services/marketplace-logger';

const log = marketplaceLogger('api');

/**
 * OLX requests routinely 401 once the access token expires. This helper runs
 * the request, and if it 401s, refreshes the token once and replays the
 * request with the new Bearer header injected.
 *
 * The init builder takes the *current* access token so the retry can pick up
 * the freshly refreshed value.
 */
async function olxFetchWithAuthRetry(
  url: string,
  buildInit: (accessToken: string) => RequestInit,
): Promise<Response> {
  const { getChannelConfig } = await import('@/services/channel-config');
  const config = (await getChannelConfig('olx')) as MarketplaceConfig | null;
  const token = typeof config?.accessToken === 'string' ? config.accessToken : '';
  if (!token) throw new Error('OLX accessToken not configured');

  let res = await fetch(url, buildInit(token));
  if (res.status !== 401) return res;

  const refresh = await refreshOlxToken();
  if (!refresh.success) return res;
  const fresh = (await getChannelConfig('olx')) as MarketplaceConfig | null;
  const newToken = typeof fresh?.accessToken === 'string' ? fresh.accessToken : '';
  if (!newToken) return res;
  res = await fetch(url, buildInit(newToken));
  return res;
}

export interface MarketplaceListingData {
  title: string;
  description: string;
  price: number;
  currency?: string;
  images: string[];
  category?: string; // resolved external category id (sent upstream)
  localCategoryId?: number; // local category id, used by the dispatcher to resolve `category`
  productCode?: string;
  /** EAN/UPC barcode (8-14 digits). Required by some marketplaces for new
   *  listings; falls back to `identifier_exists=no` semantics when missing. */
  barcode?: string;
  quantity?: number;
}

export interface MarketplaceResult {
  status: 'published' | 'failed';
  externalId?: string;
  permalink?: string;
  error?: string;
}

// ── OLX OAuth refresh ──

export async function refreshOlxToken(): Promise<{
  success: boolean;
  expiresIn?: number;
  error?: string;
}> {
  const config = (await getChannelConfig('olx')) as MarketplaceConfig | null;
  if (!config?.clientId || !config?.clientSecret || !config?.refreshToken) {
    return {
      success: false,
      error: 'Заповніть Client ID, Client Secret та Refresh Token у налаштуваннях OLX',
    };
  }

  try {
    recordMarketplaceCall('olx');
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: String(config.clientId),
      client_secret: String(config.clientSecret),
      refresh_token: String(config.refreshToken),
    });
    const res = await fetch('https://www.olx.ua/api/open/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !data.access_token) {
      return {
        success: false,
        error: data.error_description || data.error || `HTTP ${res.status}`,
      };
    }
    // Persist new tokens
    const { saveChannelConfig } = await import('@/services/channel-config');
    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : '';
    await saveChannelConfig('olx', {
      ...config,
      accessToken: data.access_token,
      ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
      ...(expiresAt ? { accessTokenExpiresAt: expiresAt } : {}),
    });
    return { success: true, expiresIn: data.expires_in };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Помилка оновлення' };
  }
}

// ── OLX ──

export async function publishToOlx(
  data: MarketplaceListingData,
  appUrl: string,
): Promise<MarketplaceResult> {
  const config = (await getChannelConfig('olx')) as MarketplaceConfig | null;
  if (!config?.clientId || !config?.accessToken) {
    return { status: 'failed', error: 'OLX не налаштовано (потрібен Client ID та Access Token)' };
  }

  recordMarketplaceCall('olx');
  try {
    const imageUrls = data.images.map((img) => (img.startsWith('http') ? img : `${appUrl}${img}`));

    const categoryId =
      data.category || (config.defaultCategoryId ? String(config.defaultCategoryId) : null);
    if (!categoryId) {
      return {
        status: 'failed',
        error: 'OLX: не вказано category_id. Налаштуйте мапінг категорій або defaultCategoryId.',
      };
    }
    if (!data.category && config.defaultCategoryId) {
      log.warn('OLX: fallback to defaultCategoryId (no mapping)', {
        platform: 'olx',
        defaultCategoryId: config.defaultCategoryId,
      });
    }

    // Product code: OLX has no buyer-visible SKU field, so we (a) send it as
    // `external_id` (OLX-side reference, used for our own mapping/sync) and
    // (b) append it to the description so buyers can quote the article.
    const description = data.productCode
      ? `${data.description}\n\nКод товару: ${data.productCode}`
      : data.description;

    // OLX Partner API (v2) schema: price is a TOP-LEVEL object with value in
    // whole UAH (not kopecks); custom fields go in `attributes` as {code,value}
    // (NOT `params`/{key,value}); `attributes` is a required field.
    // Ref: https://developer.olx.ua/swagger/v2/partner_api.yaml
    const body = {
      title: data.title.slice(0, 70), // OLX limit
      description: description.slice(0, 9000),
      category_id: Number(categoryId),
      advertiser_type: 'business',
      ...(data.productCode ? { external_id: String(data.productCode) } : {}),
      contact: { name: config.contactName || 'Pulito Trade', phone: config.contactPhone || '' },
      location: { city_id: Number(config.cityId) || 1 },
      price: {
        value: Math.round(data.price),
        currency: data.currency || 'UAH',
        negotiable: false,
      },
      attributes: [{ code: 'state', value: 'new' }],
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
      return {
        status: 'published',
        externalId: String(result.data.id),
        permalink: result.data.url,
      };
    }
    return { status: 'failed', error: result.error?.message || `HTTP ${res.status}` };
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : 'OLX API error' };
  }
}

// ── Rozetka (Seller API) ──

export async function publishToRozetka(
  data: MarketplaceListingData,
  appUrl: string,
): Promise<MarketplaceResult> {
  const config = (await getChannelConfig('rozetka')) as MarketplaceConfig | null;
  if (!config?.apiKey || !config?.sellerId) {
    return { status: 'failed', error: 'Rozetka не налаштовано (потрібен API Key та Seller ID)' };
  }

  try {
    // Rozetka auth is a /sites token exchange (login:password → 24h Bearer
    // token), not a static key — so we go through RozetkaClient, which handles
    // it. A raw `Bearer apiKey` (as before) is rejected by the API.
    const { RozetkaClient } = await import('@/services/marketplace-rozetka');
    const client = new RozetkaClient(String(config.apiKey), String(config.sellerId));
    const images = data.images.map((img) => (img.startsWith('http') ? img : `${appUrl}${img}`));
    const result = await client.createProduct({
      name: data.title,
      description: data.description,
      price: data.price,
      article: data.productCode,
      barcode: data.barcode,
      quantity: data.quantity ?? 1,
      images,
      categoryId: data.category,
    });
    if (result.success && result.externalId) {
      return {
        status: 'published',
        externalId: result.externalId,
        permalink: `https://rozetka.com.ua/ua/${result.externalId}/p${result.externalId}/`,
      };
    }
    return { status: 'failed', error: result.error || 'Rozetka API error' };
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : 'Rozetka API error' };
  }
}

// ── Prom.ua (API) ──

export async function publishToProm(
  _data: MarketplaceListingData,
  _appUrl: string,
): Promise<MarketplaceResult> {
  // Prom.ua has NO product-creation API. New products reach Prom only via the
  // YML import feed (Prom cabinet → Імпорт → за посиланням), which we serve at
  // /api/v1/feeds/prom.xml. The API can only edit price/stock of products that
  // already exist on Prom. So we don't fake an API "create" here.
  void _data;
  void _appUrl;
  return {
    status: 'failed',
    error:
      'Prom.ua не публікує товари через API. Підключіть YML-фід ' +
      '(/api/v1/feeds/prom.xml) у кабінеті Prom → Імпорт. API синхронізує лише ціну/наявність.',
  };
}

// ── Epicentr K (Marketplace API) ──

export async function publishToEpicentrk(
  _data: MarketplaceListingData,
  _appUrl: string,
): Promise<MarketplaceResult> {
  // Epicentr's merchant API (merchant-api.epicentrm.com.ua, Bearer-JWT) is
  // closed/onboarding-issued and has no public create-product schema. New
  // products reach Epicentr via the YML import feed, which we serve at
  // /api/v1/feeds/epicentr.xml — so we don't fake an API "create" here.
  void _data;
  void _appUrl;
  return {
    status: 'failed',
    error:
      'Epicentr публікується через YML-фід (/api/v1/feeds/epicentr.xml) — підключіть його ' +
      'у кабінеті Epicentr → Імпорт. API використовується лише для синку.',
  };
}

// Kept for reference / future use once Epicentr merchant-API onboarding is done.
async function _publishToEpicentrkApiUnused(
  data: MarketplaceListingData,
  appUrl: string,
): Promise<MarketplaceResult> {
  const config = (await getChannelConfig('epicentrk')) as MarketplaceConfig | null;
  if (!config?.apiKey || !config?.sellerId) {
    return { status: 'failed', error: 'Epicentr K не налаштовано (потрібен API Key та Seller ID)' };
  }

  recordMarketplaceCall('epicentrk');
  try {
    const body = {
      name: data.title,
      description: data.description,
      price: data.price,
      currency: 'UAH',
      sku: data.productCode || '',
      ...(data.barcode ? { barcode: data.barcode } : {}),
      stock: data.quantity ?? 1,
      seller_id: config.sellerId,
      ...(data.category ? { category_id: Number(data.category) || data.category } : {}),
      images: data.images.slice(0, 10).map((img) => ({
        url: img.startsWith('http') ? img : `${appUrl}${img}`,
      })),
    };

    // Correct host + auth per the official epicentrm/merchant-api samples
    // (Bearer token, merchant-api.epicentrm.com.ua/v1). The product-create
    // endpoint/schema still need verification against the merchant docs.
    const res = await fetch('https://merchant-api.epicentrm.com.ua/v1/products', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${String(config.apiKey)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    const result = await res.json();
    if (res.ok && result.id) {
      return {
        status: 'published',
        externalId: String(result.id),
        permalink: `https://epicentrk.ua/p-${result.id}.html`,
      };
    }
    return {
      status: 'failed',
      error: result.error?.message || result.message || `HTTP ${res.status}`,
    };
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : 'Epicentr API error' };
  }
}

// ── Per-marketplace price markup ──

/**
 * Returns the price for a product on the given marketplace, after applying
 * both the per-marketplace `priceMarkupPercent` config (±50% max) AND any
 * matching repricing rule (also ±50% max). Use this anywhere a price is
 * about to be sent to a marketplace API.
 */
export async function getMarketplacePrice(
  channel: string,
  basePrice: number,
  repricingCtx?: { stock?: number; categoryId?: number | null; productId?: number | null },
): Promise<number> {
  const baseMultiplier = await getPriceMultiplier(channel);
  let withBase = applyMarkup(basePrice, baseMultiplier);

  // Stack repricing rule adjustment on top of the channel-wide markup.
  if (
    repricingCtx &&
    (channel === 'olx' || channel === 'rozetka' || channel === 'prom' || channel === 'epicentrk')
  ) {
    try {
      const { evalRepricing } = await import('@/services/marketplace-repricing');
      const extra = await evalRepricing(channel, {
        stock: repricingCtx.stock ?? 0,
        now: new Date(),
        categoryId: repricingCtx.categoryId ?? null,
        productId: repricingCtx.productId ?? null,
      });
      if (extra !== 0) {
        const clamped = Math.max(-50, Math.min(50, extra));
        withBase = applyMarkup(withBase, 1 + clamped / 100);
      }
    } catch {
      // Repricing is best-effort — never block a publish on rule eval failure.
    }
  }

  return withBase;
}

/**
 * Returns the quantity to expose on the given marketplace.
 *
 * If the marketplace config specifies a `warehouseId`, the stock for that
 * specific warehouse is used as the base; otherwise `baseQuantity` (the
 * product's total quantity across all warehouses) is used.
 *
 * Then the per-marketplace `stockAllocationPercent` config (0-100) is
 * applied. Defaults to 100%.
 */
export async function getMarketplaceStock(
  channel: string,
  baseQuantity: number,
  productId?: number,
): Promise<number> {
  try {
    const config = (await getChannelConfig(
      channel as 'olx' | 'rozetka' | 'prom' | 'epicentrk',
    )) as MarketplaceConfig | null;
    if (!config) return baseQuantity;

    // If a specific warehouse is bound to this channel, pull stock from it.
    let effectiveBase = baseQuantity;
    const warehouseIdRaw = config.warehouseId;
    const warehouseId =
      typeof warehouseIdRaw === 'string'
        ? parseInt(warehouseIdRaw, 10)
        : typeof warehouseIdRaw === 'number'
          ? warehouseIdRaw
          : NaN;
    if (Number.isFinite(warehouseId) && productId != null) {
      const { prisma } = await import('@/lib/prisma');
      const stock = await prisma.warehouseStock.findUnique({
        where: { warehouseId_productId: { warehouseId, productId } },
        select: { quantity: true, reserved: true },
      });
      if (stock) {
        effectiveBase = Math.max(0, stock.quantity - stock.reserved);
      } else {
        effectiveBase = 0; // explicit: bound warehouse has no record → none allocated
      }
    }

    const raw = config.stockAllocationPercent;
    const pct = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : 100;
    if (!Number.isFinite(pct)) return effectiveBase;
    const clamped = Math.max(0, Math.min(100, pct));
    if (clamped >= 100) return effectiveBase;
    return Math.floor((effectiveBase * clamped) / 100);
  } catch {
    return baseQuantity;
  }
}

/**
 * FBO (Fulfilment by Operator) — when stock is physically held by the
 * marketplace, our stock figure should not gate listing visibility.
 *
 * Reads `fulfilmentMode` from channel config: 'fbo' | 'fbs' (default).
 * FBO mode means: trust the marketplace's stock count, don't decrement
 * locally on import. FBS mode (default) keeps current behaviour.
 */
export type FulfilmentMode = 'fbo' | 'fbs';

export async function getFulfilmentMode(channel: string): Promise<FulfilmentMode> {
  try {
    const config = (await getChannelConfig(
      channel as 'olx' | 'rozetka' | 'prom' | 'epicentrk',
    )) as MarketplaceConfig | null;
    return config?.fulfilmentMode === 'fbo' ? 'fbo' : 'fbs';
  } catch {
    return 'fbs';
  }
}

/**
 * Returns the markup multiplier for the channel.
 * 1.0 = no change; 1.05 = +5%; 0.95 = -5%.
 * Reads `priceMarkupPercent` from the channel's config (string or number, ±0–100).
 */
async function getPriceMultiplier(channel: string): Promise<number> {
  try {
    const config = (await getChannelConfig(
      channel as 'olx' | 'rozetka' | 'prom' | 'epicentrk',
    )) as MarketplaceConfig | null;
    if (!config) return 1;
    const raw = config.priceMarkupPercent;
    const pct = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : 0;
    if (!Number.isFinite(pct) || pct === 0) return 1;
    // Clamp ±50% to avoid catastrophic mistakes
    const clamped = Math.max(-50, Math.min(50, pct));
    return 1 + clamped / 100;
  } catch {
    return 1;
  }
}

function applyMarkup(price: number, multiplier: number): number {
  if (multiplier === 1) return price;
  const adjusted = price * multiplier;
  // Round to 2 decimals
  return Math.round(adjusted * 100) / 100;
}

// ── Pre-publish validation ──

const MIN_DESCRIPTION_LEN = 30;

interface ValidationRules {
  titleMax?: number;
  descriptionMax?: number;
  requireProductCode?: boolean;
  maxImages?: number;
}

const RULES: Record<string, ValidationRules> = {
  olx: { titleMax: 70, descriptionMax: 9000, requireProductCode: false, maxImages: 8 },
  rozetka: { titleMax: 200, descriptionMax: 50000, requireProductCode: true, maxImages: 10 },
  prom: { titleMax: 200, descriptionMax: 50000, requireProductCode: false, maxImages: 12 },
  epicentrk: { titleMax: 200, descriptionMax: 50000, requireProductCode: true, maxImages: 10 },
};

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateForMarketplace(
  channel: string,
  data: MarketplaceListingData,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rules = RULES[channel];
  if (!rules) {
    return { valid: false, errors: [`Невідомий маркетплейс: ${channel}`], warnings };
  }

  if (!data.title || data.title.trim().length === 0) {
    errors.push('Назва товару порожня');
  } else if (rules.titleMax && data.title.length > rules.titleMax) {
    errors.push(`Назва задовга (${data.title.length}/${rules.titleMax} символів)`);
  } else if (rules.titleMax && data.title.length < rules.titleMax * 0.5) {
    warnings.push(
      `Назва коротша за половину ліміту (${data.title.length}/${rules.titleMax}) — додайте ключові слова`,
    );
  }

  if (!data.description || data.description.trim().length === 0) {
    errors.push('Опис порожній');
  } else if (data.description.trim().length < MIN_DESCRIPTION_LEN) {
    errors.push(
      `Опис закороткий (${data.description.trim().length}/${MIN_DESCRIPTION_LEN} символів мінімум)`,
    );
  } else if (rules.descriptionMax && data.description.length > rules.descriptionMax) {
    errors.push(`Опис задовгий (${data.description.length}/${rules.descriptionMax})`);
  }

  if (!Number.isFinite(data.price) || data.price <= 0) {
    errors.push('Ціна має бути більше нуля');
  }

  if (!data.images || data.images.length === 0) {
    errors.push('Потрібно щонайменше одне фото');
  } else if (rules.maxImages && data.images.length > rules.maxImages) {
    errors.push(`Забагато фото (${data.images.length}/${rules.maxImages} макс. для ${channel})`);
  } else {
    // Sanity-check image URLs: they must be absolute https or start with /uploads/
    const badUrls = data.images.filter(
      (u) => !u || (!u.startsWith('http://') && !u.startsWith('https://') && !u.startsWith('/')),
    );
    if (badUrls.length > 0) {
      errors.push(`Невалідні URL зображень: ${badUrls.length} шт.`);
    }
    if (data.images.length < 3) {
      warnings.push('Менше 3 фото — CTR помітно падає. Рекомендуємо 4+ фото');
    }
  }

  if (rules.requireProductCode && !data.productCode) {
    errors.push('Артикул товару обовʼязковий');
  } else if (data.productCode && /[^\p{Letter}\p{Number}_\-./]/u.test(data.productCode)) {
    warnings.push(
      `Артикул "${data.productCode}" містить спецсимволи — Rozetka/Prom можуть відкинути`,
    );
  }

  // Quantity must be sane: not negative, not absurdly large.
  if (data.quantity != null) {
    if (data.quantity < 0) errors.push('Залишок не може бути відʼємним');
    if (data.quantity > 99999) warnings.push(`Залишок ${data.quantity} підозріло великий`);
    if (data.quantity === 0) warnings.push('Залишок 0 — маркетплейс приховає лістинг');
  }

  // Category check: warn if external category is required and not resolved.
  // (publishToMarketplace will refuse anyway, but a pre-publish warning is friendlier.)
  if (!data.category && data.localCategoryId == null) {
    warnings.push(
      `Категорія не вказана — використається defaultCategoryId з налаштувань ${channel}`,
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Epicentr returns ──

export async function getEpicentrkReturns(dateFrom?: string): Promise<NormalizedReturn[]> {
  const config = (await getChannelConfig('epicentrk')) as MarketplaceConfig | null;
  if (!config?.apiKey) return [];

  const params = new URLSearchParams({ limit: '50' });
  if (dateFrom) params.set('date_from', dateFrom);

  try {
    recordMarketplaceCall('epicentrk');
    const res = await fetch(`https://merchant-api.epicentrm.com.ua/v1/returns?${params}`, {
      headers: { Authorization: `Bearer ${String(config.apiKey)}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      log.error('Epicentr getReturns failed', { platform: 'epicentrk', httpStatus: res.status });
      return [];
    }
    const data = (await res.json()) as {
      data?: Record<string, unknown>[];
      returns?: Record<string, unknown>[];
    };
    const list = data.data || data.returns || [];
    return list.map(
      (r): NormalizedReturn => ({
        id: String(r.id),
        orderId: r.order_id ? String(r.order_id) : undefined,
        status: String(r.status || 'pending'),
        reason: r.reason ? String(r.reason) : undefined,
        quantity: Number(r.quantity ?? 1),
        refundAmount: r.refund_amount ? Number(r.refund_amount) : undefined,
        createdAt: r.created_at
          ? String(r.created_at)
          : r.date_created
            ? String(r.date_created)
            : undefined,
      }),
    );
  } catch (err) {
    log.error('Epicentr getReturns error', {
      platform: 'epicentrk',
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ── Dispatcher ──

async function isSandbox(channel: string): Promise<boolean> {
  try {
    const config = (await getChannelConfig(
      channel as 'olx' | 'rozetka' | 'prom' | 'epicentrk',
    )) as MarketplaceConfig | null;
    return Boolean(config?.sandboxMode);
  } catch {
    return false;
  }
}

export async function publishToMarketplace(
  channel: string,
  data: MarketplaceListingData,
  appUrl: string,
): Promise<MarketplaceResult> {
  const validation = validateForMarketplace(channel, data);
  if (!validation.valid) {
    return {
      status: 'failed',
      error: `Валідація не пройдена: ${validation.errors.join('; ')}`,
    };
  }

  // Sandbox / dry-run: log the payload that *would* be sent, return a fake success
  if (await isSandbox(channel)) {
    const fakeId = `dryrun-${Date.now()}`;
    console.log(`[MarketplaceSandbox] ${channel} publish (dry-run):`, {
      title: data.title,
      price: data.price,
      images: data.images.length,
      productCode: data.productCode,
    });
    return {
      status: 'published',
      externalId: fakeId,
      permalink: `#sandbox-${channel}-${fakeId}`,
    };
  }

  // Apply per-marketplace markup and resolve category mapping before dispatch.
  const multiplier = await getPriceMultiplier(channel);
  let externalCategory: string | null = null;
  if (
    data.localCategoryId != null &&
    (channel === 'olx' || channel === 'rozetka' || channel === 'prom' || channel === 'epicentrk')
  ) {
    const { resolveExternalCategory } = await import('@/services/marketplace-categories');
    externalCategory = await resolveExternalCategory(channel, data.localCategoryId);
  }

  const adjusted: MarketplaceListingData = {
    ...data,
    price: applyMarkup(data.price, multiplier),
    category: externalCategory || data.category,
  };

  switch (channel) {
    case 'olx':
      return publishToOlx(adjusted, appUrl);
    case 'rozetka':
      return publishToRozetka(adjusted, appUrl);
    case 'prom':
      return publishToProm(adjusted, appUrl);
    case 'epicentrk':
      return publishToEpicentrk(adjusted, appUrl);
    default:
      return { status: 'failed', error: `Невідомий маркетплейс: ${channel}` };
  }
}

// ── UPDATE listing ──

export async function updateMarketplaceListing(
  channel: string,
  externalId: string,
  data: Partial<MarketplaceListingData>,
  appUrl: string,
): Promise<MarketplaceResult> {
  // Sandbox mode: no-op, return success
  if (await isSandbox(channel)) {
    console.log(`[MarketplaceSandbox] ${channel} update ${externalId} (dry-run)`);
    return { status: 'published', externalId };
  }

  // Apply markup to price if it's being updated.
  if (typeof data.price === 'number') {
    const multiplier = await getPriceMultiplier(channel);
    data = { ...data, price: applyMarkup(data.price, multiplier) };
  }

  switch (channel) {
    case 'olx': {
      const config = (await getChannelConfig('olx')) as MarketplaceConfig | null;
      if (!config?.accessToken) return { status: 'failed', error: 'OLX не налаштовано' };
      const body: Record<string, unknown> = {};
      if (data.title) body.title = data.title.slice(0, 70);
      if (data.description) body.description = data.description.slice(0, 9000);
      if (data.price)
        body.price = { value: Math.round(data.price), currency: 'UAH', negotiable: false };
      if (data.images?.length)
        body.images = data.images
          .slice(0, 8)
          .map((url) => ({ url: url.startsWith('http') ? url : `${appUrl}${url}` }));
      const res = await fetchWithRateLimit(`https://www.olx.ua/api/partner/adverts/${externalId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
          Version: '2.0',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      return res.ok
        ? { status: 'published', externalId }
        : { status: 'failed', error: `HTTP ${res.status}` };
    }
    case 'rozetka': {
      const config = (await getChannelConfig('rozetka')) as MarketplaceConfig | null;
      if (!config?.apiKey) return { status: 'failed', error: 'Rozetka не налаштовано' };
      // Use RozetkaClient for the /sites token auth (raw Bearer apiKey fails).
      const { RozetkaClient } = await import('@/services/marketplace-rozetka');
      const client = new RozetkaClient(
        String(config.apiKey),
        config.sellerId != null ? String(config.sellerId) : undefined,
      );
      const upd = await client.updateProduct(externalId, {
        ...(data.title ? { name: data.title } : {}),
        ...(data.description ? { description: data.description } : {}),
        ...(data.price ? { price: data.price } : {}),
        ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
      });
      return upd.success
        ? { status: 'published', externalId }
        : { status: 'failed', error: upd.error || 'Rozetka update error' };
    }
    case 'prom': {
      const config = (await getChannelConfig('prom')) as MarketplaceConfig | null;
      if (!config?.apiToken) return { status: 'failed', error: 'Prom.ua не налаштовано' };
      // Prom `products/edit` takes a {products:[{id,...}]} array and only edits
      // price/presence/quantity/status — name/description/images come from the
      // YML import feed, not the API. So we sync only the editable fields.
      const product: Record<string, unknown> = { id: Number(externalId) };
      if (data.price) product.price = data.price;
      if (data.quantity !== undefined) {
        product.quantity_in_stock = data.quantity;
        product.presence = data.quantity > 0 ? 'available' : 'not_available';
      }
      const res = await fetchWithRateLimit('https://my.prom.ua/api/v1/products/edit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: [product] }),
        signal: AbortSignal.timeout(15000),
      });
      return res.ok
        ? { status: 'published', externalId }
        : { status: 'failed', error: `HTTP ${res.status}` };
    }
    case 'epicentrk': {
      const config = (await getChannelConfig('epicentrk')) as MarketplaceConfig | null;
      if (!config?.apiKey) return { status: 'failed', error: 'Epicentr K не налаштовано' };
      const body: Record<string, unknown> = {};
      if (data.title) body.name = data.title;
      if (data.description) body.description = data.description;
      if (data.price) body.price = data.price;
      if (data.quantity !== undefined) body.stock = data.quantity;
      const res = await fetchWithRateLimit(
        `https://merchant-api.epicentrm.com.ua/v1/products/${externalId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${String(config.apiKey)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        },
      );
      return res.ok
        ? { status: 'published', externalId }
        : { status: 'failed', error: `HTTP ${res.status}` };
    }
    default:
      return { status: 'failed', error: `Невідомий маркетплейс: ${channel}` };
  }
}

// ── DELETE listing ──

export async function deleteMarketplaceListing(
  channel: string,
  externalId: string,
): Promise<MarketplaceResult> {
  if (await isSandbox(channel)) {
    console.log(`[MarketplaceSandbox] ${channel} delete ${externalId} (dry-run)`);
    return { status: 'published' };
  }

  switch (channel) {
    case 'olx': {
      const config = (await getChannelConfig('olx')) as MarketplaceConfig | null;
      if (!config?.accessToken) return { status: 'failed', error: 'OLX не налаштовано' };
      const res = await fetch(`https://www.olx.ua/api/partner/adverts/${externalId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${config.accessToken}`, Version: '2.0' },
        signal: AbortSignal.timeout(15000),
      });
      return res.ok || res.status === 404
        ? { status: 'published' }
        : { status: 'failed', error: `HTTP ${res.status}` };
    }
    case 'rozetka': {
      const config = (await getChannelConfig('rozetka')) as MarketplaceConfig | null;
      if (!config?.apiKey) return { status: 'failed', error: 'Rozetka не налаштовано' };
      const res = await fetch(`https://api-seller.rozetka.com.ua/items/${externalId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(15000),
      });
      return res.ok || res.status === 404
        ? { status: 'published' }
        : { status: 'failed', error: `HTTP ${res.status}` };
    }
    case 'prom': {
      const config = (await getChannelConfig('prom')) as MarketplaceConfig | null;
      if (!config?.apiToken) return { status: 'failed', error: 'Prom.ua не налаштовано' };
      const res = await fetch(`https://my.prom.ua/api/v1/products/edit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: [{ id: Number(externalId), status: 'deleted' }] }),
        signal: AbortSignal.timeout(15000),
      });
      // Treat 404 the same as success — the listing is already gone, which is
      // what the caller wanted. Keeps unpublish idempotent across re-runs.
      return res.ok || res.status === 404
        ? { status: 'published' }
        : { status: 'failed', error: `HTTP ${res.status}` };
    }
    case 'epicentrk': {
      const config = (await getChannelConfig('epicentrk')) as MarketplaceConfig | null;
      if (!config?.apiKey) return { status: 'failed', error: 'Epicentr K не налаштовано' };
      const res = await fetch(`https://merchant-api.epicentrm.com.ua/v1/products/${externalId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${String(config.apiKey)}` },
        signal: AbortSignal.timeout(15000),
      });
      return res.ok || res.status === 404
        ? { status: 'published' }
        : { status: 'failed', error: `HTTP ${res.status}` };
    }
    default:
      return { status: 'failed', error: `Невідомий маркетплейс: ${channel}` };
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
      const config = (await getChannelConfig('olx')) as MarketplaceConfig | null;
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
      } catch {
        return [];
      }
    }
    case 'rozetka': {
      const config = (await getChannelConfig('rozetka')) as MarketplaceConfig | null;
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
      } catch {
        return [];
      }
    }
    case 'prom': {
      const config = (await getChannelConfig('prom')) as MarketplaceConfig | null;
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
      } catch {
        return [];
      }
    }
    default:
      return [];
  }
}

// ── Reply to marketplace message ──

export async function replyToMarketplaceMessage(
  channel: string,
  threadId: string,
  text: string,
): Promise<{ success: boolean; error?: string }> {
  if (!text.trim()) return { success: false, error: 'Порожнє повідомлення' };

  try {
    switch (channel) {
      case 'olx': {
        const config = (await getChannelConfig('olx')) as MarketplaceConfig | null;
        if (!config?.accessToken) return { success: false, error: 'OLX не налаштовано' };
        recordMarketplaceCall('olx');
        const res = await fetch(
          `https://www.olx.ua/api/partner/threads/${encodeURIComponent(threadId)}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.accessToken}`,
              'Content-Type': 'application/json',
              Version: '2.0',
            },
            body: JSON.stringify({ body: text }),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { success: false, error: data.error?.message || `HTTP ${res.status}` };
        }
        return { success: true };
      }
      case 'rozetka': {
        const config = (await getChannelConfig('rozetka')) as MarketplaceConfig | null;
        if (!config?.apiKey) return { success: false, error: 'Rozetka не налаштовано' };
        recordMarketplaceCall('rozetka');
        const res = await fetch('https://api-seller.rozetka.com.ua/orders/messages', {
          method: 'POST',
          headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message_id: threadId, body: text }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { success: false, error: data.errors?.[0]?.message || `HTTP ${res.status}` };
        }
        return { success: true };
      }
      case 'prom': {
        const config = (await getChannelConfig('prom')) as MarketplaceConfig | null;
        if (!config?.apiToken) return { success: false, error: 'Prom не налаштовано' };
        recordMarketplaceCall('prom');
        const res = await fetch('https://my.prom.ua/api/v1/messages/reply', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message_id: Number(threadId), text }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { success: false, error: data.message || `HTTP ${res.status}` };
        }
        return { success: true };
      }
      case 'epicentrk': {
        // Epicentr K's public marketplace API does not yet expose a messages
        // endpoint — admins should reply through the seller cabinet web UI.
        return {
          success: false,
          error: 'Epicentr K не надає API для відповідей. Відкрийте кабінет продавця у браузері.',
        };
      }
      default:
        return { success: false, error: `Відповідь на ${channel} не підтримується` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Помилка відправки' };
  }
}

// ── Sync prices for all published products ──

export async function syncMarketplacePrices(
  channel: string,
  listings: { externalId: string; price: number; quantity: number }[],
  appUrl: string,
): Promise<{ updated: number; failed: number }> {
  let updated = 0;
  let failed = 0;

  for (const listing of listings) {
    try {
      const result = await withRetry(
        () =>
          updateMarketplaceListing(
            channel,
            listing.externalId,
            {
              price: listing.price,
              quantity: listing.quantity,
            },
            appUrl,
          ),
        { maxRetries: 3, baseDelayMs: 1000 },
      );
      if (result.status === 'published') updated++;
      else failed++;
    } catch {
      failed++;
    }
  }

  return { updated, failed };
}

// Re-export the canonical list from marketplace-health to keep this file
// in sync without forcing every caller to migrate import paths. Adding a
// new marketplace now only requires editing MARKETPLACE_PLATFORMS.
export { MARKETPLACE_PLATFORMS as MARKETPLACE_CHANNELS } from '@/services/marketplace-health';

// ── Generic order shape used by importOrdersFromMarketplace ──

export interface NormalizedOrder {
  id: string | number;
  buyerName: string;
  buyerPhone?: string;
  buyerEmail?: string;
  items: { name: string; quantity: number; price: number; code?: string }[];
  createdAt?: string;
}

// ── OLX orders ──

export async function getOlxOrders(dateFrom?: string): Promise<NormalizedOrder[]> {
  const config = (await getChannelConfig('olx')) as MarketplaceConfig | null;
  if (!config?.accessToken) return [];

  const params = new URLSearchParams({ limit: '50' });
  if (dateFrom) params.set('created_at_from', dateFrom);

  try {
    const res = await olxFetchWithAuthRetry(
      `https://www.olx.ua/api/partner/orders?${params}`,
      (token) => ({
        headers: { Authorization: `Bearer ${token}`, Version: '2.0' },
        signal: AbortSignal.timeout(15000),
      }),
    );
    if (!res.ok) {
      log.error('OLX getOrders failed', { platform: 'olx', httpStatus: res.status });
      return [];
    }
    const data = (await res.json()) as { data?: Record<string, unknown>[] };
    return (data.data || []).map((o) => {
      const buyer = (o.buyer as Record<string, unknown>) || {};
      const items = ((o.items as Record<string, unknown>[]) || []).map((it) => ({
        name: String(it.title || it.name || 'Товар'),
        quantity: Number(it.quantity ?? 1),
        price: Number(it.price ?? 0),
        code: it.advert_id ? String(it.advert_id) : undefined,
      }));
      return {
        id: String(o.id),
        buyerName: String(buyer.name || buyer.first_name || 'Покупець OLX'),
        buyerPhone: buyer.phone ? String(buyer.phone) : undefined,
        buyerEmail: buyer.email ? String(buyer.email) : undefined,
        items,
        createdAt: o.created_at ? String(o.created_at) : undefined,
      };
    });
  } catch (err) {
    log.error('OLX getOrders error', {
      platform: 'olx',
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ── OLX returns ──

export interface NormalizedReturn {
  id: string;
  orderId?: string;
  status: string;
  reason?: string;
  quantity: number;
  refundAmount?: number;
  createdAt?: string;
}

export async function getOlxReturns(dateFrom?: string): Promise<NormalizedReturn[]> {
  const config = (await getChannelConfig('olx')) as MarketplaceConfig | null;
  if (!config?.accessToken) return [];

  const params = new URLSearchParams({ limit: '50' });
  if (dateFrom) params.set('created_at_from', dateFrom);

  try {
    recordMarketplaceCall('olx');
    const res = await olxFetchWithAuthRetry(
      `https://www.olx.ua/api/partner/returns?${params}`,
      (token) => ({
        headers: { Authorization: `Bearer ${token}`, Version: '2.0' },
        signal: AbortSignal.timeout(15000),
      }),
    );
    if (!res.ok) {
      log.error('OLX getReturns failed', { platform: 'olx', httpStatus: res.status });
      return [];
    }
    const data = (await res.json()) as { data?: Record<string, unknown>[] };
    return (data.data || []).map(
      (r): NormalizedReturn => ({
        id: String(r.id),
        orderId: r.order_id ? String(r.order_id) : undefined,
        status: String(r.status || 'pending'),
        reason: r.reason ? String(r.reason) : undefined,
        quantity: Number(r.quantity ?? 1),
        refundAmount: r.refund_amount ? Number(r.refund_amount) : undefined,
        createdAt: r.created_at ? String(r.created_at) : undefined,
      }),
    );
  } catch (err) {
    log.error('OLX getReturns error', {
      platform: 'olx',
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ── Epicentr orders ──

export async function getEpicentrkOrders(dateFrom?: string): Promise<NormalizedOrder[]> {
  const config = (await getChannelConfig('epicentrk')) as MarketplaceConfig | null;
  if (!config?.apiKey) return [];

  const params = new URLSearchParams({ limit: '50' });
  if (dateFrom) params.set('date_from', dateFrom);

  try {
    const res = await fetch(`https://merchant-api.epicentrm.com.ua/v1/orders?${params}`, {
      headers: { Authorization: `Bearer ${String(config.apiKey)}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      log.error('Epicentr getOrders failed', { platform: 'epicentrk', httpStatus: res.status });
      return [];
    }
    const data = (await res.json()) as {
      data?: Record<string, unknown>[];
      orders?: Record<string, unknown>[];
    };
    const list = data.data || data.orders || [];
    return list.map((o) => {
      const buyer =
        (o.buyer as Record<string, unknown>) || (o.customer as Record<string, unknown>) || {};
      const itemsRaw =
        (o.items as Record<string, unknown>[]) || (o.products as Record<string, unknown>[]) || [];
      const items = itemsRaw.map((it) => ({
        name: String(it.name || it.title || 'Товар'),
        quantity: Number(it.quantity ?? it.stock ?? 1),
        price: Number(it.price ?? 0),
        code: it.sku ? String(it.sku) : it.product_id ? String(it.product_id) : undefined,
      }));
      return {
        id: String(o.id),
        buyerName: String(buyer.name || buyer.full_name || 'Покупець Epicentr'),
        buyerPhone: buyer.phone ? String(buyer.phone) : undefined,
        buyerEmail: buyer.email ? String(buyer.email) : undefined,
        items,
        createdAt: o.created_at
          ? String(o.created_at)
          : o.date_created
            ? String(o.date_created)
            : undefined,
      };
    });
  } catch (err) {
    log.error('Epicentr getOrders error', {
      platform: 'epicentrk',
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
