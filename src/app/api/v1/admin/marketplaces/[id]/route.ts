import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  updateMarketplaceListing,
  deleteMarketplaceListing,
  MARKETPLACE_CHANNELS,
} from '@/services/marketplaces';
import {
  getConnectionStatus,
  syncProductsToMarketplace,
  syncStockToMarketplace,
  importOrdersFromMarketplace,
} from '@/services/marketplace-sync';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

const VALID_CHANNELS: readonly string[] = MARKETPLACE_CHANNELS;

const VALID_PLATFORMS = ['olx', 'rozetka', 'prom', 'epicentrk'] as const;
type Platform = (typeof VALID_PLATFORMS)[number];

function isValidPlatform(value: string): value is Platform {
  return (VALID_PLATFORMS as readonly string[]).includes(value);
}

// GET — connection status for a specific platform
export const GET = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    if (!isValidPlatform(id)) {
      return errorResponse('Невідома платформа', 400);
    }

    const status = await getConnectionStatus(id);
    return successResponse(status);
  } catch (err) {
    logger.error('[admin/marketplaces/[id]] GET failed', { error: err });
    return errorResponse('Помилка завантаження статусу маркетплейсу', 500);
  }
});

// Update a marketplace listing
export const PUT = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { channel, externalId, title, description, price, quantity, images } = body;

    if (!channel || !externalId) {
      return errorResponse("channel та externalId обов'язкові", 400);
    }

    if (!VALID_CHANNELS.includes(channel)) {
      return errorResponse('Невідомий маркетплейс', 400);
    }

    const result = await updateMarketplaceListing(
      channel,
      externalId,
      {
        title,
        description,
        price,
        quantity,
        images,
      },
      env.APP_URL,
    );

    if (result.status === 'published') {
      return successResponse({ updated: true, externalId });
    }
    return errorResponse(result.error || 'Помилка оновлення', 400);
  } catch (err) {
    logger.error('[admin/marketplaces/[id]] PUT failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

// PATCH — update marketplace config
export const PATCH = withRole('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    if (!isValidPlatform(id)) {
      return errorResponse('Невідома платформа', 400);
    }

    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    // Store marketplace config in settings
    const configKey = `marketplace_config_${id}`;
    await prisma.siteSetting.upsert({
      where: { key: configKey },
      update: { value: JSON.stringify(body) },
      create: { key: configKey, value: JSON.stringify(body) },
    });

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'marketplace_config',
      details: { platform: id, fields: Object.keys(body) },
    });

    return successResponse({ message: `Налаштування ${id} оновлено` });
  } catch (err) {
    logger.error('[admin/marketplaces/[id]] PATCH failed', { error: err });
    return errorResponse('Помилка оновлення налаштувань маркетплейсу', 500);
  }
});

// POST — trigger sync now
export const POST = withRole('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    if (!isValidPlatform(id)) {
      return errorResponse('Невідома платформа', 400);
    }

    const body = await request.json().catch(() => ({}));
    const action = (body as { action?: string }).action || 'products';

    let result;
    switch (action) {
      case 'products':
        result = await syncProductsToMarketplace(id);
        break;
      case 'stock':
        result = await syncStockToMarketplace(id);
        break;
      case 'orders':
        result = await importOrdersFromMarketplace(id);
        break;
      default:
        return errorResponse('Невідома дія. Використовуйте: products, stock, orders', 400);
    }

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'marketplace_sync',
      details: { platform: id, action },
    });

    return successResponse(result);
  } catch (error) {
    logger.error('[admin/marketplaces/[id]] POST failed', { error });
    const message = error instanceof Error ? error.message : 'Помилка синхронізації';
    return errorResponse(message, 500);
  }
});

// Delete a marketplace listing
export const DELETE = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const { searchParams } = request.nextUrl;
    const channel = searchParams.get('channel');
    const externalId = searchParams.get('externalId');

    if (!channel || !externalId) {
      return errorResponse("channel та externalId обов'язкові", 400);
    }

    if (!VALID_CHANNELS.includes(channel)) {
      return errorResponse('Невідомий маркетплейс', 400);
    }

    // Idempotency lock: atomically transition the matching publicationChannel
    // row into a transient `deleting` status. If the row was already in that
    // state, another concurrent DELETE is in flight — return 409 instead of
    // hitting the marketplace API a second time (which on OLX/Rozetka would
    // surface as a confusing "listing not found" error to the user).
    const { prisma } = await import('@/lib/prisma');
    const existing = await prisma.publicationChannel.findFirst({
      where: { channel, externalId },
    });
    if (existing) {
      const claim = await prisma.publicationChannel.updateMany({
        where: { id: existing.id, NOT: { status: 'deleting' } },
        data: { status: 'deleting' },
      });
      if (claim.count === 0) {
        return errorResponse('Видалення вже виконується', 409);
      }
    }

    let result;
    try {
      result = await deleteMarketplaceListing(channel, externalId);
    } catch (err) {
      // Roll the lock back so the user can retry — otherwise the listing
      // would stay stuck in `deleting`.
      if (existing) {
        await prisma.publicationChannel.updateMany({
          where: { id: existing.id },
          data: { status: existing.status },
        });
      }
      throw err;
    }

    if (result.status === 'published') {
      // Mirror the deletion in our DB so the listing no longer shows as published.
      await prisma.publicationChannel.updateMany({
        where: { channel, externalId },
        data: { status: 'unpublished', externalId: null, permalink: null },
      });
      await logAudit({
        userId: user.id,
        actionType: 'data_delete',
        entityType: 'marketplace_listing',
        details: { channel, externalId },
      });
      return successResponse({ deleted: true });
    }

    // Marketplace API failed — restore previous status so the user can retry.
    if (existing) {
      await prisma.publicationChannel.updateMany({
        where: { id: existing.id },
        data: { status: existing.status },
      });
    }
    return errorResponse(result.error || 'Помилка видалення', 400);
  } catch (err) {
    logger.error('[admin/marketplaces/[id]] DELETE failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
