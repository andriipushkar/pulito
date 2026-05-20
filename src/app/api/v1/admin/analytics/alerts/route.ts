import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const createAlertSchema = z.object({
  metric: z.enum(['daily_revenue', 'daily_orders', 'avg_check', 'stock_zero', 'new_users', 'cancelled_orders']),
  condition: z.enum(['above', 'below']),
  threshold: z.number().min(0),
  channel: z.enum(['email', 'telegram']),
});

export const GET = withRole('admin', 'manager')(async (_request: NextRequest, { user }) => {
  try {
    const alerts = await prisma.analyticsAlert.findMany({
      where: { createdBy: user.id },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = alerts.map((a) => {
      const condition = a.condition as { metric?: string; condition?: string; threshold?: number };
      return {
        id: String(a.id),
        metric: condition.metric || a.alertType,
        condition: condition.condition || 'below',
        threshold: condition.threshold || 0,
        channel: a.notificationChannels,
        isActive: a.isActive,
      };
    });

    return successResponse(mapped);
  } catch (err) {
    logger.error('[admin/analytics/alerts] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole('admin', 'manager')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createAlertSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const alert = await prisma.analyticsAlert.create({
      data: {
        createdBy: user.id,
        alertType: parsed.data.metric,
        condition: {
          metric: parsed.data.metric,
          condition: parsed.data.condition,
          threshold: parsed.data.threshold,
        },
        notificationChannels: parsed.data.channel,
        isActive: true,
      },
    });

    return successResponse({
      id: String(alert.id),
      metric: parsed.data.metric,
      condition: parsed.data.condition,
      threshold: parsed.data.threshold,
      channel: parsed.data.channel,
      isActive: true,
    });
  } catch (err) {
    logger.error('[admin/analytics/alerts] POST failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
