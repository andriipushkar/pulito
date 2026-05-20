import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const settingsSchema = z.object({
  layout: z.object({
    widgetOrder: z.array(z.string()),
    hiddenWidgets: z.array(z.string()),
  }).optional(),
  lowStockThreshold: z.number().int().min(1).max(1000).optional(),
  refreshIntervalSeconds: z.number().int().min(10).max(600).optional(),
});

export const GET = withRole('admin', 'manager')(async (_request: NextRequest, { user }) => {
  try {
    const settings = await prisma.dashboardSettings.findUnique({
      where: { userId: user.id },
    });

    return successResponse(settings || {
      layout: { widgetOrder: ['stats', 'users', 'products', 'topProducts'], hiddenWidgets: [] },
      lowStockThreshold: 10,
      refreshIntervalSeconds: 60,
    });
  } catch (err) {
    logger.error('[admin/dashboard/settings] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PUT = withRole('admin', 'manager')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const settings = await prisma.dashboardSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        layout: parsed.data.layout as object,
        lowStockThreshold: parsed.data.lowStockThreshold ?? 10,
        refreshIntervalSeconds: parsed.data.refreshIntervalSeconds ?? 60,
      },
      update: {
        ...(parsed.data.layout !== undefined && { layout: parsed.data.layout as object }),
        ...(parsed.data.lowStockThreshold !== undefined && { lowStockThreshold: parsed.data.lowStockThreshold }),
        ...(parsed.data.refreshIntervalSeconds !== undefined && { refreshIntervalSeconds: parsed.data.refreshIntervalSeconds }),
      },
    });

    return successResponse(settings);
  } catch (err) {
    logger.error('[admin/dashboard/settings] PUT failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
