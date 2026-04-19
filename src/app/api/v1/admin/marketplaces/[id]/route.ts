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

const VALID_CHANNELS: readonly string[] = MARKETPLACE_CHANNELS;

const VALID_PLATFORMS = ['rozetka', 'prom'] as const;
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
  } catch {
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
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

// PATCH — update marketplace config
export const PATCH = withRole('admin')(async (request: NextRequest, { params }) => {
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

    return successResponse({ message: `Налаштування ${id} оновлено` });
  } catch {
    return errorResponse('Помилка оновлення налаштувань маркетплейсу', 500);
  }
});

// POST — trigger sync now
export const POST = withRole('admin')(async (request: NextRequest, { params }) => {
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

    return successResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Помилка синхронізації';
    return errorResponse(message, 500);
  }
});

// Delete a marketplace listing
export const DELETE = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
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

    const result = await deleteMarketplaceListing(channel, externalId);

    if (result.status === 'published') {
      return successResponse({ deleted: true });
    }
    return errorResponse(result.error || 'Помилка видалення', 400);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
