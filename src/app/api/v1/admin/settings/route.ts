import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { invalidateSettingsCache } from '@/services/settings';

export const GET = withRole('admin')(
  async () => {
    try {
      const settings = await prisma.siteSetting.findMany({
        orderBy: { key: 'asc' },
      });
      const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
      return successResponse(map);
    } catch {
      return errorResponse('Помилка завантаження налаштувань', 500);
    }
  }
);

export const PUT = withRole('admin')(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const entries = Object.entries(body) as [string, string][];

      for (const [key, value] of entries) {
        await prisma.siteSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        });
      }

      await invalidateSettingsCache();
      return successResponse({ updated: entries.length });
    } catch {
      return errorResponse('Помилка збереження налаштувань', 500);
    }
  }
);
