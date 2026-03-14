import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { cacheInvalidate } from '@/services/cache';

export const GET = withRole('admin', 'manager')(async () => {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'maintenance_mode' },
    });
    return successResponse({
      enabled: setting?.value === 'true',
      message: (await prisma.siteSetting.findUnique({ where: { key: 'maintenance_message' } }))?.value || '',
    });
  } catch {
    return errorResponse('Помилка', 500);
  }
});

export const PUT = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const { enabled, message } = await request.json();

    await prisma.siteSetting.upsert({
      where: { key: 'maintenance_mode' },
      update: { value: String(!!enabled), updatedBy: user.id },
      create: { key: 'maintenance_mode', value: String(!!enabled), updatedBy: user.id },
    });

    if (message !== undefined) {
      await prisma.siteSetting.upsert({
        where: { key: 'maintenance_message' },
        update: { value: message, updatedBy: user.id },
        create: { key: 'maintenance_message', value: message, updatedBy: user.id },
      });
    }

    await cacheInvalidate('maintenance:*');
    await cacheInvalidate('settings:*');

    return successResponse({ enabled: !!enabled });
  } catch {
    return errorResponse('Помилка', 500);
  }
});
