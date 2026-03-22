import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  getConnectionStatus,
  syncProductsToMarketplace,
  syncStockToMarketplace,
  importOrdersFromMarketplace,
} from '@/services/marketplace-sync';
import { successResponse, errorResponse } from '@/utils/api-response';

const VALID_PLATFORMS = ['rozetka', 'prom'] as const;
type Platform = (typeof VALID_PLATFORMS)[number];

function isValidPlatform(value: string): value is Platform {
  return (VALID_PLATFORMS as readonly string[]).includes(value);
}

// GET — connection status for a specific platform
export const GET = withRole('admin', 'manager')(
  async (_request: NextRequest, { params }) => {
    try {
      const { platform } = await params!;
      if (!isValidPlatform(platform)) {
        return errorResponse('Невідома платформа', 400);
      }

      const status = await getConnectionStatus(platform);
      return successResponse(status);
    } catch {
      return errorResponse('Помилка завантаження статусу маркетплейсу', 500);
    }
  }
);

// PATCH — update marketplace config
export const PATCH = withRole('admin')(
  async (request: NextRequest, { params }) => {
    try {
      const { platform } = await params!;
      if (!isValidPlatform(platform)) {
        return errorResponse('Невідома платформа', 400);
      }

      const body = await request.json();
      const { prisma } = await import('@/lib/prisma');

      // Store marketplace config in settings
      const configKey = `marketplace_config_${platform}`;
      await prisma.setting.upsert({
        where: { key: configKey },
        update: { value: JSON.stringify(body) },
        create: { key: configKey, value: JSON.stringify(body) },
      });

      return successResponse({ message: `Налаштування ${platform} оновлено` });
    } catch {
      return errorResponse('Помилка оновлення налаштувань маркетплейсу', 500);
    }
  }
);

// POST — trigger sync now
export const POST = withRole('admin')(
  async (request: NextRequest, { params }) => {
    try {
      const { platform } = await params!;
      if (!isValidPlatform(platform)) {
        return errorResponse('Невідома платформа', 400);
      }

      const body = await request.json().catch(() => ({}));
      const action = (body as { action?: string }).action || 'products';

      let result;
      switch (action) {
        case 'products':
          result = await syncProductsToMarketplace(platform);
          break;
        case 'stock':
          result = await syncStockToMarketplace(platform);
          break;
        case 'orders':
          result = await importOrdersFromMarketplace(platform);
          break;
        default:
          return errorResponse('Невідома дія. Використовуйте: products, stock, orders', 400);
      }

      return successResponse(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Помилка синхронізації';
      return errorResponse(message, 500);
    }
  }
);
