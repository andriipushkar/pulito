import { prisma } from '@/lib/prisma';
import { RozetkaClient } from './marketplace-rozetka';
import { PromClient } from './marketplace-prom';
import { getChannelConfig, type MarketplaceConfig } from '@/services/channel-config';

type Platform = 'rozetka' | 'prom';

function getClient(platform: Platform, config: MarketplaceConfig): RozetkaClient | PromClient {
  switch (platform) {
    case 'rozetka':
      return new RozetkaClient(config.apiKey!, config.sellerId);
    case 'prom':
      return new PromClient(config.apiToken!);
    default:
      throw new Error(`Невідома платформа: ${platform}`);
  }
}

export async function syncProductsToMarketplace(
  platform: Platform
): Promise<{ created: number; updated: number; failed: number }> {
  const config = await getChannelConfig(platform) as MarketplaceConfig | null;
  if (!config?.enabled) {
    throw new Error(`${platform} не налаштовано або вимкнено`);
  }

  const client = getClient(platform, config);
  let created = 0;
  let updated = 0;
  let failed = 0;

  // Get all active products with their publication channels
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      priceRetail: true,
      code: true,
      quantity: true,
      images: { select: { url: true }, take: 10 },
      publications: {
        select: {
          id: true,
          channels: {
            where: { channel: platform },
            select: { externalId: true, status: true },
          },
        },
      },
    },
  });

  for (const product of products) {
    try {
      const publication = product.publications[0];
      const channelEntry = publication?.channels[0];

      if (channelEntry?.externalId) {
        // Update existing listing
        const result = await client.updateProduct(channelEntry.externalId, {
          name: product.name,
          price: Number(product.priceRetail),
          quantity: product.quantity,
        });
        if (result.success) updated++;
        else failed++;
      } else {
        // Create new listing
        const imageUrls = product.images.map((img) => img.url);
        const result = await client.createProduct({
          name: product.name,
          description: product.description || undefined,
          price: Number(product.priceRetail),
          quantity: product.quantity,
          images: imageUrls,
          ...(platform === 'rozetka' ? { article: product.code } : { sku: product.code }),
        });

        if (result.success && result.externalId) {
          // Save the external ID in publication channel
          if (publication) {
            await prisma.publicationChannel.upsert({
              where: {
                publicationId_channel: {
                  publicationId: publication.id,
                  channel: platform,
                },
              },
              update: { externalId: result.externalId, status: 'published' },
              create: {
                publicationId: publication.id,
                channel: platform,
                externalId: result.externalId,
                status: 'published',
              },
            });
          }
          created++;
        } else {
          failed++;
        }
      }
    } catch (error) {
      console.error(`[MarketplaceSync] Помилка синхронізації товару ${product.id} на ${platform}:`, error);
      failed++;
    }
  }

  // Update last sync time
  await updateLastSyncTime(platform, 'products');

  return { created, updated, failed };
}

export async function syncStockToMarketplace(
  platform: Platform
): Promise<{ updated: number; failed: number }> {
  const config = await getChannelConfig(platform) as MarketplaceConfig | null;
  if (!config?.enabled) {
    throw new Error(`${platform} не налаштовано або вимкнено`);
  }

  const client = getClient(platform, config);
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
      const result = await client.updateStock(
        pub.externalId,
        pub.publication.product.quantity
      );
      if (result.success) updated++;
      else failed++;
    } catch (error) {
      console.error(`[MarketplaceSync] Помилка оновлення залишків ${pub.externalId} на ${platform}:`, error);
      failed++;
    }
  }

  await updateLastSyncTime(platform, 'stock');

  return { updated, failed };
}

export async function importOrdersFromMarketplace(
  platform: Platform
): Promise<{ imported: number; skipped: number; failed: number }> {
  const config = await getChannelConfig(platform) as MarketplaceConfig | null;
  if (!config?.enabled) {
    throw new Error(`${platform} не налаштовано або вимкнено`);
  }

  const client = getClient(platform, config);
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  // Fetch orders from the last 7 days
  const dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const orders = await client.getOrders(dateFrom);

  for (const order of orders) {
    try {
      const externalOrderId = String(order.id);

      // Check if order already imported
      const existing = await prisma.order.findFirst({
        where: { externalId: externalOrderId, source: platform },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Map order data to local format
      const orderItems = 'items' in order
        ? (order.items as { name: string; quantity: number; price: number | string }[])
        : (order as { products?: { name: string; quantity: number; price: number | string }[] }).products || [];

      const totalAmount = orderItems.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      );

      const buyerName = 'buyer' in order
        ? (order.buyer as { name: string }).name
        : `${(order as { client_first_name?: string }).client_first_name || ''} ${(order as { client_last_name?: string }).client_last_name || ''}`.trim();

      const buyerPhone = 'buyer' in order
        ? (order.buyer as { phone: string }).phone
        : (order as { phone?: string }).phone || '';

      await prisma.order.create({
        data: {
          externalId: externalOrderId,
          source: platform,
          status: 'new',
          totalAmount,
          customerName: buyerName || 'Покупець',
          customerPhone: buyerPhone,
          items: {
            create: orderItems.map((item) => ({
              productName: item.name,
              quantity: item.quantity,
              price: Number(item.price),
            })),
          },
        },
      });

      imported++;
    } catch (error) {
      console.error(`[MarketplaceSync] Помилка імпорту замовлення ${order.id} з ${platform}:`, error);
      failed++;
    }
  }

  await updateLastSyncTime(platform, 'orders');

  return { imported, skipped, failed };
}

export async function getConnectionStatus(
  platform: Platform
): Promise<{
  connected: boolean;
  platform: string;
  lastSyncProducts?: string | null;
  lastSyncStock?: string | null;
  lastSyncOrders?: string | null;
  publishedCount: number;
}> {
  const config = await getChannelConfig(platform) as MarketplaceConfig | null;
  const connected = !!(config?.enabled);

  const publishedCount = await prisma.publicationChannel.count({
    where: { channel: platform, status: 'published' },
  });

  // Get last sync times from settings
  const syncSettings = await prisma.setting.findMany({
    where: {
      key: { in: [
        `marketplace_sync_${platform}_products`,
        `marketplace_sync_${platform}_stock`,
        `marketplace_sync_${platform}_orders`,
      ] },
    },
  });

  const syncMap = Object.fromEntries(syncSettings.map((s) => [s.key, s.value]));

  return {
    connected,
    platform,
    lastSyncProducts: syncMap[`marketplace_sync_${platform}_products`] || null,
    lastSyncStock: syncMap[`marketplace_sync_${platform}_stock`] || null,
    lastSyncOrders: syncMap[`marketplace_sync_${platform}_orders`] || null,
    publishedCount,
  };
}

async function updateLastSyncTime(platform: string, type: string) {
  const key = `marketplace_sync_${platform}_${type}`;
  const value = new Date().toISOString();

  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
