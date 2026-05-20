import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { MARKETPLACE_PLATFORMS, isMarketplacePlatform } from '@/services/marketplace-health';
import { getChannelConfig, type MarketplaceConfig } from '@/services/channel-config';
import {
  publishToMarketplace,
  deleteMarketplaceListing,
  validateForMarketplace,
  type MarketplaceListingData,
} from '@/services/marketplaces';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';

interface ChannelInfo {
  channel: string;
  status: string;
  externalId: string | null;
  permalink: string | null;
  errorMessage: string | null;
  publishedAt: string | null;
  publicationId: number | null;
  configured: boolean;
  excluded: boolean;
}

export const GET = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const productId = Number(id);
    if (!Number.isFinite(productId)) return errorResponse('Невалідний ID', 400);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, excludedMarketplaces: true },
    });
    if (!product) return errorResponse('Товар не знайдено', 404);

    const excludedList = Array.isArray(product.excludedMarketplaces)
      ? (product.excludedMarketplaces as string[])
      : [];

    const channels = await prisma.publicationChannel.findMany({
      where: {
        channel: { in: MARKETPLACE_PLATFORMS as readonly string[] as string[] },
        publication: { productId },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        channel: true,
        status: true,
        externalId: true,
        permalink: true,
        errorMessage: true,
        publishedAt: true,
        publicationId: true,
      },
    });

    const latestByChannel = new Map<string, (typeof channels)[number]>();
    for (const c of channels) {
      if (!latestByChannel.has(c.channel)) latestByChannel.set(c.channel, c);
    }

    const result: ChannelInfo[] = [];
    for (const platform of MARKETPLACE_PLATFORMS) {
      const config = (await getChannelConfig(platform)) as MarketplaceConfig | null;
      const latest = latestByChannel.get(platform);
      result.push({
        channel: platform,
        status: latest?.status || 'not_published',
        externalId: latest?.externalId || null,
        permalink: latest?.permalink || null,
        errorMessage: latest?.errorMessage || null,
        publishedAt: latest?.publishedAt ? latest.publishedAt.toISOString() : null,
        publicationId: latest?.publicationId || null,
        configured: !!config?.enabled,
        excluded: excludedList.includes(platform),
      });
    }

    return successResponse(result);
  } catch (err) {
    logger.error('[admin/products/[id]/marketplaces] GET failed', { error: err });
    return errorResponse('Внутрішня помилка', 500);
  }
});

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const productId = Number(id);
    if (!Number.isFinite(productId)) return errorResponse('Невалідний ID', 400);

    const body = (await request.json().catch(() => ({}))) as { channel?: string };
    const channel = body.channel;
    if (!channel || !isMarketplacePlatform(channel)) {
      return errorResponse('Невідомий маркетплейс', 400);
    }

    const config = (await getChannelConfig(channel)) as MarketplaceConfig | null;
    if (!config?.enabled) {
      return errorResponse(`${channel} не налаштовано`, 400);
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        content: { select: { fullDescription: true } },
        images: {
          select: { pathFull: true, pathOriginal: true, pathMedium: true },
          orderBy: { sortOrder: 'asc' },
          take: 12,
        },
      },
    });
    if (!product) return errorResponse('Товар не знайдено', 404);

    const excluded = Array.isArray(product.excludedMarketplaces)
      ? (product.excludedMarketplaces as string[])
      : [];
    if (excluded.includes(channel)) {
      return errorResponse(`Цей товар виключено з ${channel}. Зніміть виключення на сторінці товару.`, 400);
    }

    const imageUrls = product.images
      .map((img) => img.pathFull || img.pathOriginal || img.pathMedium)
      .filter((u): u is string => Boolean(u));

    const data: MarketplaceListingData = {
      title: product.name,
      description: product.content?.fullDescription || product.name,
      price: Number(product.priceRetail),
      images: imageUrls,
      productCode: product.code,
      quantity: product.quantity,
      localCategoryId: product.categoryId ?? undefined,
    };

    // Pre-validate so the admin gets a clear list of issues to fix.
    const validation = validateForMarketplace(channel, data);
    if (!validation.valid) {
      return errorResponse(`Валідація не пройдена: ${validation.errors.join('; ')}`, 400);
    }

    const result = await publishToMarketplace(channel, data, env.APP_URL);
    if (result.status !== 'published' || !result.externalId) {
      return errorResponse(result.error || 'Не вдалося опублікувати', 400);
    }

    // Persist as a publication + publication_channel so it shows up in History and per-product list
    const publication = await prisma.publication.create({
      data: {
        title: product.name,
        content: data.description,
        productId: product.id,
        channels: [channel],
        status: 'published',
        publishedAt: new Date(),
        createdBy: user.id,
        channelResults: {
          create: {
            channel,
            status: 'published',
            externalId: result.externalId,
            permalink: result.permalink || null,
            publishedAt: new Date(),
          },
        },
      },
      select: { id: true },
    });

    return successResponse({
      publicationId: publication.id,
      externalId: result.externalId,
      permalink: result.permalink,
    });
  } catch (error) {
    logger.error('[admin/products/[id]/marketplaces] POST failed', { error });
    const message = error instanceof Error ? error.message : 'Помилка публікації';
    return errorResponse(message, 500);
  }
});

export const PATCH = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const productId = Number(id);
    if (!Number.isFinite(productId)) return errorResponse('Невалідний ID', 400);

    const body = (await request.json()) as { channel?: string; excluded?: boolean };
    if (!body.channel || !isMarketplacePlatform(body.channel)) {
      return errorResponse('Невідомий маркетплейс', 400);
    }
    if (typeof body.excluded !== 'boolean') {
      return errorResponse('excluded має бути boolean', 400);
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { excludedMarketplaces: true },
    });
    if (!product) return errorResponse('Товар не знайдено', 404);

    const current = Array.isArray(product.excludedMarketplaces)
      ? (product.excludedMarketplaces as string[])
      : [];
    const next = body.excluded
      ? Array.from(new Set([...current, body.channel]))
      : current.filter((p) => p !== body.channel);

    await prisma.product.update({
      where: { id: productId },
      data: { excludedMarketplaces: next as unknown as Parameters<typeof prisma.product.update>[0]['data']['excludedMarketplaces'] },
    });

    return successResponse({ excludedMarketplaces: next });
  } catch (error) {
    logger.error('[admin/products/[id]/marketplaces] PATCH failed', { error });
    const message = error instanceof Error ? error.message : 'Помилка оновлення';
    return errorResponse(message, 500);
  }
});

export const DELETE = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const productId = Number(id);
    if (!Number.isFinite(productId)) return errorResponse('Невалідний ID', 400);

    const { searchParams } = request.nextUrl;
    const channel = searchParams.get('channel');
    if (!channel || !isMarketplacePlatform(channel)) {
      return errorResponse('Невідомий маркетплейс', 400);
    }

    // Find the latest published listing for this product on this channel
    const listing = await prisma.publicationChannel.findFirst({
      where: {
        channel,
        status: 'published',
        externalId: { not: null },
        publication: { productId },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!listing?.externalId) {
      return errorResponse('Активного лістингу не знайдено', 404);
    }

    const result = await deleteMarketplaceListing(channel, listing.externalId);
    if (result.status !== 'published') {
      return errorResponse(result.error || 'Не вдалося видалити', 400);
    }

    await prisma.publicationChannel.update({
      where: { id: listing.id },
      data: { status: 'unpublished', externalId: null, permalink: null },
    });

    return successResponse({ deleted: true });
  } catch (error) {
    logger.error('[admin/products/[id]/marketplaces] DELETE failed', { error });
    const message = error instanceof Error ? error.message : 'Помилка видалення';
    return errorResponse(message, 500);
  }
});
