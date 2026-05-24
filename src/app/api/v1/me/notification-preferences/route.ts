import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, privateResponse, errorResponse } from '@/utils/api-response';

const prefsSchema = z.object({
  email_orders: z.boolean().optional(),
  email_promo: z.boolean().optional(),
  email_price_change: z.boolean().optional(),
  telegram_orders: z.boolean().optional(),
  telegram_promo: z.boolean().optional(),
  push_orders: z.boolean().optional(),
  push_promo: z.boolean().optional(),
  viber_orders: z.boolean().optional(),
  viber_promo: z.boolean().optional(),
});

export const GET = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: { notificationPrefs: true },
    });

    const defaults = {
      email_orders: true,
      email_promo: true,
      email_price_change: true,
      telegram_orders: true,
      telegram_promo: false,
      push_orders: true,
      push_promo: false,
      viber_orders: true,
      viber_promo: false,
    };

    return privateResponse({
      ...defaults,
      ...((u?.notificationPrefs as object) || {}),
    });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PUT = withAuth(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = prefsSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }

    const current = await prisma.user.findUnique({
      where: { id: user.id },
      select: { notificationPrefs: true },
    });

    const merged = {
      ...((current?.notificationPrefs as object) || {}),
      ...parsed.data,
    };

    await prisma.user.update({
      where: { id: user.id },
      data: { notificationPrefs: merged },
    });

    return successResponse(merged);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
