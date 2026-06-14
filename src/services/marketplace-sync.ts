import { prisma } from '@/lib/prisma';
import { RozetkaClient } from './marketplace-rozetka';
import { PromClient } from './marketplace-prom';
import { getChannelConfig, type MarketplaceConfig } from '@/services/channel-config';
import { marketplaceLogger } from '@/services/marketplace-logger';

const log = marketplaceLogger('sync');
import {
  publishToMarketplace,
  updateMarketplaceListing,
  getOlxOrders,
  getEpicentrkOrders,
  getOlxReturns,
  getEpicentrkReturns,
  getMarketplacePrice,
  getMarketplaceStock,
  getFulfilmentMode,
  type MarketplaceListingData,
  type NormalizedOrder,
  type NormalizedReturn,
} from '@/services/marketplaces';
import { env } from '@/config/env';

export type Platform = 'olx' | 'rozetka' | 'prom' | 'epicentrk';
type ClientBackedPlatform = 'rozetka' | 'prom';

function asString(value: string | boolean | undefined): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return String(value);
  return '';
}

function hasClientBackedSync(platform: Platform): platform is ClientBackedPlatform {
  return platform === 'rozetka' || platform === 'prom';
}

function getClient(
  platform: ClientBackedPlatform,
  config: MarketplaceConfig,
): RozetkaClient | PromClient {
  switch (platform) {
    case 'rozetka':
      return new RozetkaClient(asString(config.apiKey), asString(config.sellerId));
    case 'prom':
      return new PromClient(asString(config.apiToken));
    default: {
      const _exhaustive: never = platform;
      throw new Error(`Невідома платформа: ${String(_exhaustive)}`);
    }
  }
}

export async function syncProductsToMarketplace(
  platform: Platform,
): Promise<{ created: number; updated: number; failed: number }> {
  const config = (await getChannelConfig(platform)) as MarketplaceConfig | null;
  if (!config?.enabled) {
    throw new Error(`${platform} не налаштовано або вимкнено`);
  }

  const client = hasClientBackedSync(platform) ? getClient(platform, config) : null;
  let created = 0;
  let updated = 0;
  let failed = 0;

  // Get all active products with their publication channels
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      content: { select: { fullDescription: true } },
      images: {
        select: { pathFull: true, pathOriginal: true, pathMedium: true },
        take: 10,
      },
      publications: {
        select: {
          id: true,
          channelResults: {
            where: { channel: platform },
            select: { externalId: true, status: true },
          },
        },
      },
    },
  });

  for (const product of products) {
    try {
      // Skip products explicitly excluded from this marketplace.
      const excluded = Array.isArray(product.excludedMarketplaces)
        ? (product.excludedMarketplaces as string[])
        : [];
      if (excluded.includes(platform)) continue;

      const publication = product.publications[0];
      const channelEntry = publication?.channelResults[0];
      const imageUrls = product.images
        .map((img) => img.pathFull || img.pathOriginal || img.pathMedium)
        .filter((u): u is string => Boolean(u));

      if (channelEntry?.externalId) {
        // Update existing listing
        let ok = false;
        const allocatedStock = await getMarketplaceStock(platform, product.quantity, product.id);
        if (client) {
          const result = await client.updateProduct(channelEntry.externalId, {
            name: product.name,
            price: await getMarketplacePrice(platform, Number(product.priceRetail)),
            quantity: allocatedStock,
          });
          ok = result.success;
        } else {
          const result = await updateMarketplaceListing(
            platform,
            channelEntry.externalId,
            {
              title: product.name,
              description: product.content?.fullDescription || product.name,
              price: Number(product.priceRetail),
              quantity: allocatedStock,
              images: imageUrls,
            },
            env.APP_URL,
          );
          ok = result.status === 'published';
        }
        if (ok) updated++;
        else failed++;
      } else {
        // Create new listing
        let externalId: string | undefined;
        let permalink: string | undefined;
        const allocatedStock = await getMarketplaceStock(platform, product.quantity, product.id);
        if (client) {
          const result = await client.createProduct({
            name: product.name,
            description: product.content?.fullDescription || undefined,
            price: await getMarketplacePrice(platform, Number(product.priceRetail)),
            quantity: allocatedStock,
            images: imageUrls,
            ...(product.barcode ? { barcode: product.barcode } : {}),
            ...(platform === 'rozetka' ? { article: product.code } : { sku: product.code }),
          });
          if (result.success) externalId = result.externalId;
        } else {
          const data: MarketplaceListingData = {
            title: product.name,
            description: product.content?.fullDescription || product.name,
            price: Number(product.priceRetail),
            images: imageUrls,
            productCode: product.code,
            barcode: product.barcode ?? undefined,
            quantity: allocatedStock,
            localCategoryId: product.categoryId ?? undefined,
          };
          const result = await publishToMarketplace(platform, data, env.APP_URL);
          if (result.status === 'published') {
            externalId = result.externalId;
            permalink = result.permalink;
          }
        }

        if (externalId) {
          // Save the external ID in publication channel
          if (publication) {
            await prisma.publicationChannel.upsert({
              where: {
                publicationId_channel: {
                  publicationId: publication.id,
                  channel: platform,
                },
              },
              update: {
                externalId,
                status: 'published',
                ...(permalink ? { permalink } : {}),
              },
              create: {
                publicationId: publication.id,
                channel: platform,
                externalId,
                status: 'published',
                ...(permalink ? { permalink } : {}),
              },
            });
          }
          created++;
        } else {
          failed++;
        }
      }
    } catch (error) {
      log.error('Помилка синхронізації товару', {
        platform,
        productId: product.id,
        error: error instanceof Error ? error.message : String(error),
      });
      failed++;
    }
  }

  // Update last sync time
  await updateLastSyncTime(platform, 'products');

  return { created, updated, failed };
}

export async function syncStockToMarketplace(
  platform: Platform,
): Promise<{ updated: number; failed: number }> {
  const config = (await getChannelConfig(platform)) as MarketplaceConfig | null;
  if (!config?.enabled) {
    throw new Error(`${platform} не налаштовано або вимкнено`);
  }

  const client = hasClientBackedSync(platform) ? getClient(platform, config) : null;
  let updated = 0;
  let failed = 0;

  // Get all published listings for this platform
  const publications = await prisma.publicationChannel.findMany({
    where: { channel: platform, status: 'published', externalId: { not: null } },
    include: {
      publication: {
        select: {
          productId: true,
          product: { select: { quantity: true, priceRetail: true } },
        },
      },
    },
  });

  for (const pub of publications) {
    if (!pub.externalId || !pub.publication.product) continue;

    try {
      const allocatedStock = await getMarketplaceStock(
        platform,
        pub.publication.product.quantity,
        pub.publication.productId ?? undefined,
      );
      let ok = false;
      if (client) {
        const result = await client.updateStock(pub.externalId, allocatedStock);
        ok = result.success;
      } else {
        const result = await updateMarketplaceListing(
          platform,
          pub.externalId,
          { quantity: allocatedStock },
          env.APP_URL,
        );
        ok = result.status === 'published';
      }
      if (ok) updated++;
      else failed++;
    } catch (error) {
      log.error('Помилка оновлення залишків', {
        platform,
        externalId: pub.externalId,
        error: error instanceof Error ? error.message : String(error),
      });
      failed++;
    }
  }

  await updateLastSyncTime(platform, 'stock');

  return { updated, failed };
}

async function fetchOrdersForPlatform(
  platform: Platform,
  config: MarketplaceConfig,
  dateFrom: string,
): Promise<NormalizedOrder[]> {
  if (hasClientBackedSync(platform)) {
    const client = getClient(platform, config);
    const raw = await client.getOrders(dateFrom);
    // Marketplace APIs sometimes report quantity as a float ("2.0" or even
    // "2.5"). The DB column is Int, so passing it through Number() and then
    // storing would silently truncate, leaving Product.quantity drift behind
    // the marketplace's view. Round to the nearest whole unit and clamp to
    // a sensible minimum.
    const safeQty = (raw: unknown) => {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 1) return 1;
      return Math.round(n);
    };
    return raw.map((order): NormalizedOrder => {
      const items =
        'items' in order
          ? order.items.map((it) => ({
              name: it.name,
              quantity: safeQty(it.quantity),
              price: Number(it.price),
              code: 'id' in it ? String(it.id) : undefined,
            }))
          : 'products' in order
            ? order.products.map((it) => ({
                name: it.name,
                quantity: safeQty(it.quantity),
                price: Number(it.price),
                code: 'id' in it ? String(it.id) : undefined,
              }))
            : [];

      const buyerName =
        'buyer' in order
          ? order.buyer.name
          : `${order.client_first_name || ''} ${order.client_last_name || ''}`.trim();
      const buyerPhone =
        'buyer' in order ? order.buyer.phone : 'phone' in order ? order.phone : undefined;
      const buyerEmail =
        'buyer' in order
          ? order.buyer.email
          : 'email' in order
            ? (order as { email?: string }).email
            : undefined;

      return {
        id: String(order.id),
        buyerName: buyerName || 'Покупець',
        buyerPhone,
        buyerEmail,
        items,
        createdAt:
          'created' in order
            ? order.created
            : 'date_created' in order
              ? order.date_created
              : undefined,
      };
    });
  }

  if (platform === 'olx') return getOlxOrders(dateFrom);
  if (platform === 'epicentrk') return getEpicentrkOrders(dateFrom);
  return [];
}

export async function importOrdersFromMarketplace(
  platform: Platform,
): Promise<{ imported: number; skipped: number; failed: number }> {
  const config = (await getChannelConfig(platform)) as MarketplaceConfig | null;
  if (!config?.enabled) {
    throw new Error(`${platform} не налаштовано або вимкнено`);
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  const dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const orders = await fetchOrdersForPlatform(platform, config, dateFrom);
  const fulfilmentMode = await getFulfilmentMode(platform);

  // Aggregates which local products had their stock decremented; flushed once
  // after all orders are imported so other marketplaces get the latest figure.
  // FBO orders never touch local stock — the marketplace is holding the goods.
  const touchedProductIds = new Set<number>();

  // Items that ended up oversold during this run — flushed into a single
  // Telegram alert at the end so the manager isn't spammed per line item.
  const oversoldByOrder = new Map<
    string,
    { code: string; name?: string; requested: number; available: number }[]
  >();

  for (const order of orders) {
    try {
      const externalOrderId = String(order.id);

      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.order.findFirst({
          where: { externalId: externalOrderId, source: platform },
        });
        if (existing) return { kind: 'skipped' as const };

        // Guard against malformed marketplace payloads — Number("") is NaN,
        // and Prisma will happily persist NaN as a float. Treat any
        // unparseable line as 0; the resulting underbilled order surfaces in
        // analytics for manual review rather than crashing reconciliation.
        const totalAmount = order.items.reduce((sum, item) => {
          const price = Number(item.price);
          const qty = Number(item.quantity);
          if (!Number.isFinite(price) || !Number.isFinite(qty) || price < 0 || qty < 0) {
            return sum;
          }
          return sum + price * qty;
        }, 0);

        // Resolve supplier link by product code so marketplace sales of
        // supplier-owned goods show up in the reconciliation report (same
        // snapshot the web checkout captures). Codes with no local product, or
        // products with no supplier, simply stay null.
        const codes = order.items.map((i) => i.code).filter((c): c is string => !!c);
        const codeToSnap = new Map<string, { supplierId: number | null; cost: unknown }>();
        if (codes.length > 0) {
          const linked = await tx.product.findMany({
            where: { code: { in: codes }, supplierId: { not: null } },
            select: { code: true, supplierId: true, cost: true },
          });
          for (const p of linked)
            codeToSnap.set(p.code, { supplierId: p.supplierId, cost: p.cost });
        }

        await tx.order.create({
          data: {
            orderNumber: `${platform.toUpperCase()}-${externalOrderId}`,
            externalId: externalOrderId,
            source: platform,
            status: 'new_order',
            clientType: 'retail',
            totalAmount,
            itemsCount: order.items.reduce((s, i) => s + i.quantity, 0),
            contactName: order.buyerName || 'Покупець',
            contactPhone: order.buyerPhone || '',
            contactEmail: order.buyerEmail || '',
            deliveryMethod: 'nova_poshta',
            paymentMethod: 'cod',
            items: {
              create: order.items.map((item) => {
                const snap = item.code ? codeToSnap.get(item.code) : undefined;
                return {
                  productCode: item.code || 'UNKNOWN',
                  productName: item.name,
                  quantity: item.quantity,
                  priceAtOrder: Number(item.price),
                  subtotal: Number(item.price) * item.quantity,
                  supplierId: snap?.supplierId ?? null,
                  supplierCostAtSale: (snap?.cost ?? null) as never,
                };
              }),
            },
          },
        });

        // Atomically decrement local stock for each line item so other
        // marketplaces don't continue advertising units we no longer have.
        // If the local quantity is already lower than requested, we still
        // create the order (the marketplace already accepted the sale) and
        // log the discrepancy for manual reconciliation.
        // FBO orders skip this entirely — the marketplace owns the inventory.
        const affected: number[] = [];
        const oversold: { code: string; name?: string; requested: number; available: number }[] =
          [];
        if (fulfilmentMode === 'fbo') {
          return { kind: 'imported' as const, affected, oversold };
        }
        for (const item of order.items) {
          if (!item.code) continue;
          const product = await tx.product.findUnique({
            where: { code: item.code },
            select: { id: true, quantity: true, name: true },
          });
          if (!product) continue;
          const decremented = await tx.product.updateMany({
            where: { id: product.id, quantity: { gte: item.quantity } },
            data: { quantity: { decrement: item.quantity } },
          });
          if (decremented.count === 0) {
            log.warn('Недостатньо залишку', {
              platform,
              externalOrderId,
              productCode: item.code,
              requested: item.quantity,
              available: product.quantity,
            });
            // Force quantity to 0 (we already owe the customer the product).
            await tx.product.update({
              where: { id: product.id },
              data: { quantity: 0 },
            });
            oversold.push({
              code: item.code,
              name: product.name,
              requested: item.quantity,
              available: product.quantity,
            });
          }
          affected.push(product.id);
        }
        return { kind: 'imported' as const, affected, oversold };
      });

      if (result.kind === 'skipped') skipped++;
      else {
        imported++;
        for (const id of result.affected) touchedProductIds.add(id);
        if (result.oversold.length > 0) {
          oversoldByOrder.set(String(order.id), result.oversold);
        }
      }
    } catch (error) {
      log.error('Помилка імпорту замовлення', {
        platform,
        externalOrderId: String(order.id),
        error: error instanceof Error ? error.message : String(error),
      });
      failed++;
    }
  }

  await updateLastSyncTime(platform, 'orders');

  // Fire-and-forget: propagate the new stock to every other marketplace so the
  // race window between "OLX sold one" and "Rozetka still says available" shrinks.
  if (touchedProductIds.size > 0) {
    void syncProductsStockToMarketplaces([...touchedProductIds]).catch((err) => {
      log.error('Failed to propagate stock after import', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // Fire-and-forget: alert the manager about every oversold order.
  if (oversoldByOrder.size > 0) {
    void (async () => {
      try {
        const { notifyManagerOversoldAlert } = await import('@/services/telegram');
        for (const [externalOrderId, items] of oversoldByOrder) {
          await notifyManagerOversoldAlert({ platform, externalOrderId, items });
        }
      } catch (err) {
        log.error('Failed to send oversold alert', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }

  return { imported, skipped, failed };
}

/**
 * Pushes the current price of the given products to every enabled marketplace
 * that has published listings for them. Per-marketplace markup applies
 * automatically via updateMarketplaceListing/client.updateProduct.
 *
 * Fire-and-forget. Errors are logged, never thrown.
 */
export async function syncProductsPriceToMarketplaces(productIds: number[]): Promise<void> {
  if (productIds.length === 0) return;

  try {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, priceRetail: true },
    });
    const priceMap = new Map(products.map((p) => [p.id, Number(p.priceRetail)]));

    const platforms: Platform[] = ['olx', 'rozetka', 'prom', 'epicentrk'];

    for (const platform of platforms) {
      const config = (await getChannelConfig(platform)) as MarketplaceConfig | null;
      if (!config?.enabled) continue;

      const listings = await prisma.publicationChannel.findMany({
        where: {
          channel: platform,
          status: 'published',
          externalId: { not: null },
          publication: { productId: { in: productIds } },
        },
        select: {
          externalId: true,
          publication: { select: { productId: true } },
        },
      });

      for (const listing of listings) {
        if (!listing.externalId || listing.publication.productId == null) continue;
        const newPrice = priceMap.get(listing.publication.productId);
        if (newPrice == null) continue;

        try {
          if (hasClientBackedSync(platform)) {
            const client = getClient(platform, config);
            await client.updateProduct(listing.externalId, {
              price: await (
                await import('@/services/marketplaces')
              ).getMarketplacePrice(platform, newPrice),
            });
          } else {
            await updateMarketplaceListing(
              platform,
              listing.externalId,
              { price: newPrice },
              env.APP_URL,
            );
          }
        } catch (err) {
          log.error('Не вдалось оновити ціну', {
            platform,
            externalId: listing.externalId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  } catch (err) {
    log.error('syncProductsPriceToMarketplaces fatal', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Pushes the current quantity of the given products to every enabled marketplace
 * that has published listings for them. Designed to be called fire-and-forget
 * after order checkout so listings reflect reality without overselling.
 *
 * Errors are caught per-listing and logged — they should never propagate up to
 * the caller (the order has already been created).
 */
/**
 * Maps our local order status to the marketplace's status code.
 * Returns null when the marketplace doesn't expect us to push this transition
 * (e.g. status that the marketplace owns itself).
 */
function mapLocalToMarketplaceStatus(platform: Platform, localStatus: string): string | null {
  // We only push statuses that mean "we did something" (shipped) or "we're
  // closing it" (completed/cancelled). The marketplace owns its own "new/processing".
  const common: Record<string, Record<string, string>> = {
    olx: { shipped: 'shipped', completed: 'finished', cancelled: 'cancelled' },
    rozetka: { shipped: 'sent', completed: 'finished', cancelled: 'canceled' },
    prom: { shipped: 'delivered', completed: 'received', cancelled: 'canceled' },
    epicentrk: { shipped: 'shipped', completed: 'completed', cancelled: 'cancelled' },
  };
  return common[platform]?.[localStatus] || null;
}

/**
 * Pushes a local order status change back to the originating marketplace.
 * Fire-and-forget. Errors are logged.
 */
export async function pushOrderStatusToMarketplace(
  orderId: number,
  newStatus: string,
): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { externalId: true, source: true },
    });
    if (!order?.externalId) return;
    const source = order.source as Platform;
    if (!['olx', 'rozetka', 'prom', 'epicentrk'].includes(source)) return;

    const mappedStatus = mapLocalToMarketplaceStatus(source, newStatus);
    if (!mappedStatus) return;

    const config = (await getChannelConfig(source)) as MarketplaceConfig | null;
    if (!config?.enabled) return;

    const externalId = order.externalId;

    try {
      if (source === 'rozetka' && config.apiKey) {
        await fetch(`https://api-seller.rozetka.com.ua/orders/${externalId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: mappedStatus }),
          signal: AbortSignal.timeout(15000),
        });
      } else if (source === 'prom' && config.apiToken) {
        await fetch('https://my.prom.ua/api/v1/orders/set_status', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: mappedStatus, ids: [Number(externalId)] }),
          signal: AbortSignal.timeout(15000),
        });
      } else if (source === 'olx' && config.accessToken) {
        await fetch(`https://www.olx.ua/api/partner/orders/${externalId}/status`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
            Version: '2.0',
          },
          body: JSON.stringify({ status: mappedStatus }),
          signal: AbortSignal.timeout(15000),
        });
      } else if (source === 'epicentrk' && config.apiKey) {
        await fetch(`https://marketplace.epicentrk.ua/api/v1/orders/${externalId}/status`, {
          method: 'PUT',
          headers: { 'X-Api-Key': String(config.apiKey), 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: mappedStatus }),
          signal: AbortSignal.timeout(15000),
        });
      }
    } catch (err) {
      log.error('Не вдалось оновити статус замовлення', {
        platform: source,
        externalId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } catch (err) {
    log.error('pushOrderStatusToMarketplace fatal', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function syncProductsStockToMarketplaces(productIds: number[]): Promise<void> {
  if (productIds.length === 0) return;

  try {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, quantity: true },
    });
    const stockMap = new Map(products.map((p) => [p.id, p.quantity]));

    const platforms: Platform[] = ['olx', 'rozetka', 'prom', 'epicentrk'];

    for (const platform of platforms) {
      const config = (await getChannelConfig(platform)) as MarketplaceConfig | null;
      if (!config?.enabled) continue;

      const listings = await prisma.publicationChannel.findMany({
        where: {
          channel: platform,
          status: 'published',
          externalId: { not: null },
          publication: { productId: { in: productIds } },
        },
        select: {
          externalId: true,
          publication: { select: { productId: true } },
        },
      });

      for (const listing of listings) {
        if (!listing.externalId || listing.publication.productId == null) continue;
        const newQty = stockMap.get(listing.publication.productId);
        if (newQty == null) continue;

        const allocatedQty = await getMarketplaceStock(
          platform,
          newQty,
          listing.publication.productId,
        );
        try {
          if (hasClientBackedSync(platform)) {
            const client = getClient(platform, config);
            await client.updateStock(listing.externalId, allocatedQty);
          } else {
            await updateMarketplaceListing(
              platform,
              listing.externalId,
              { quantity: allocatedQty },
              env.APP_URL,
            );
          }
        } catch (err) {
          log.error('Не вдалось оновити залишок', {
            platform,
            externalId: listing.externalId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  } catch (err) {
    log.error('syncProductsStockToMarketplaces fatal', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function getConnectionStatus(platform: Platform): Promise<{
  connected: boolean;
  platform: string;
  lastSyncProducts?: string | null;
  lastSyncStock?: string | null;
  lastSyncOrders?: string | null;
  publishedCount: number;
}> {
  const config = (await getChannelConfig(platform)) as MarketplaceConfig | null;
  const connected = !!config?.enabled;

  const publishedCount = await prisma.publicationChannel.count({
    where: { channel: platform, status: 'published' },
  });

  // Get last sync times from settings
  const syncSettings = await prisma.siteSetting.findMany({
    where: {
      key: {
        in: [
          `marketplace_sync_${platform}_products`,
          `marketplace_sync_${platform}_stock`,
          `marketplace_sync_${platform}_orders`,
        ],
      },
    },
  });

  const syncMap = Object.fromEntries(
    syncSettings.map((s: { key: string; value: string }) => [s.key, s.value]),
  );

  return {
    connected,
    platform,
    lastSyncProducts: syncMap[`marketplace_sync_${platform}_products`] || null,
    lastSyncStock: syncMap[`marketplace_sync_${platform}_stock`] || null,
    lastSyncOrders: syncMap[`marketplace_sync_${platform}_orders`] || null,
    publishedCount,
  };
}

export async function getOrCreateConnectionId(platform: Platform): Promise<number> {
  const existing = await prisma.marketplaceConnection.findUnique({ where: { platform } });
  if (existing) return existing.id;
  const created = await prisma.marketplaceConnection.create({
    data: { platform, isActive: true },
  });
  return created.id;
}

async function fetchReturnsForPlatform(
  platform: Platform,
  config: MarketplaceConfig,
  dateFrom: string,
): Promise<NormalizedReturn[]> {
  if (hasClientBackedSync(platform)) {
    const client = getClient(platform, config);
    const raw = await client.getReturns(dateFrom);
    return raw.map(
      (r): NormalizedReturn => ({
        id: String(r.id),
        orderId: 'order_id' in r && r.order_id ? String(r.order_id) : undefined,
        status: r.status,
        reason: r.reason || undefined,
        quantity: r.quantity || 1,
        refundAmount: r.refund_amount || undefined,
        createdAt: 'created' in r && typeof r.created === 'string' ? r.created : undefined,
      }),
    );
  }
  if (platform === 'olx') return getOlxReturns(dateFrom);
  if (platform === 'epicentrk') return getEpicentrkReturns(dateFrom);
  return [];
}

export async function syncReturns(): Promise<{
  synced: number;
  perPlatform: Record<string, number>;
}> {
  let synced = 0;
  const perPlatform: Record<string, number> = {};

  const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const platforms: Platform[] = ['olx', 'rozetka', 'prom', 'epicentrk'];

  for (const platform of platforms) {
    perPlatform[platform] = 0;
    try {
      const config = (await getChannelConfig(platform)) as MarketplaceConfig | null;
      if (!config?.enabled) continue;

      const connectionId = await getOrCreateConnectionId(platform);
      const returns = await fetchReturnsForPlatform(platform, config, dateFrom);

      for (const ret of returns) {
        const externalReturnId = ret.id;
        const externalOrderId = ret.orderId || '';

        const localOrder = externalOrderId
          ? await prisma.order.findFirst({
              where: { externalId: externalOrderId, source: platform },
              select: { id: true },
            })
          : null;

        await prisma.marketplaceReturn.upsert({
          where: {
            connectionId_externalReturnId: {
              connectionId,
              externalReturnId,
            },
          },
          update: {
            reason: ret.reason || null,
            status: mapReturnStatus(ret.status),
            quantity: ret.quantity || 1,
            refundAmount: ret.refundAmount || null,
          },
          create: {
            connectionId,
            externalReturnId,
            orderId: localOrder?.id || null,
            reason: ret.reason || null,
            status: mapReturnStatus(ret.status),
            quantity: ret.quantity || 1,
            refundAmount: ret.refundAmount || null,
          },
        });

        synced++;
        perPlatform[platform]++;
      }

      await updateLastSyncTime(platform, 'returns');
    } catch (error) {
      log.error('Помилка синхронізації повернень', {
        platform,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { synced, perPlatform };
}

export function mapReturnStatus(
  externalStatus: string,
): 'pending' | 'approved' | 'rejected' | 'completed' {
  const statusMap: Record<string, 'pending' | 'approved' | 'rejected' | 'completed'> = {
    pending: 'pending',
    new: 'pending',
    approved: 'approved',
    accepted: 'approved',
    rejected: 'rejected',
    declined: 'rejected',
    completed: 'completed',
    refunded: 'completed',
    closed: 'completed',
  };
  return statusMap[externalStatus.toLowerCase()] || 'pending';
}

/**
 * Push a return-status decision back to the marketplace API. Best-effort:
 * returns success on 2xx/404 (404 means the marketplace already finalised it),
 * otherwise an error. Different marketplaces expose different endpoints; for
 * platforms without a documented return-decision API the call is a no-op that
 * returns success=true so the local status update can proceed.
 */
export async function pushReturnDecision(
  platform: Platform,
  externalReturnId: string,
  decision: 'approved' | 'rejected' | 'completed',
): Promise<{ success: boolean; error?: string }> {
  try {
    const config = (await getChannelConfig(platform)) as MarketplaceConfig | null;
    if (!config?.enabled) {
      return { success: false, error: `${platform} не налаштовано` };
    }

    const actionMap: Record<typeof decision, string> = {
      approved: 'accept',
      rejected: 'reject',
      completed: 'complete',
    };

    switch (platform) {
      case 'rozetka': {
        const apiKey = typeof config.apiKey === 'string' ? config.apiKey : '';
        if (!apiKey) return { success: false, error: 'Rozetka API key не вказано' };
        const res = await fetch(
          `https://api-seller.rozetka.com.ua/returns/${encodeURIComponent(externalReturnId)}/${actionMap[decision]}`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(15000),
          },
        );
        if (res.ok || res.status === 404) return { success: true };
        return { success: false, error: `HTTP ${res.status}` };
      }
      case 'prom': {
        const token = typeof config.apiToken === 'string' ? config.apiToken : '';
        if (!token) return { success: false, error: 'Prom API token не вказано' };
        const res = await fetch('https://my.prom.ua/api/v1/returns/set_status', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: Number(externalReturnId), status: decision }),
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok || res.status === 404) return { success: true };
        return { success: false, error: `HTTP ${res.status}` };
      }
      case 'olx':
      case 'epicentrk':
      default:
        // No documented partner API for return decisions — local-only status update.
        return { success: true };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Помилка push' };
  }
}

async function updateLastSyncTime(platform: string, type: string) {
  const key = `marketplace_sync_${platform}_${type}`;
  const value = new Date().toISOString();

  await prisma.siteSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
