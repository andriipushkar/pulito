import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

const PLATFORMS = ['telegram', 'viber', 'facebook', 'instagram', 'web'] as const;

const createSchema = z.object({
  platform: z.enum(PLATFORMS),
  messageText: z.string().min(1, 'messageText обовʼязковий').max(4000),
  messageImage: z.string().url().nullable().optional(),
  buttons: z.array(z.object({
    text: z.string().min(1).max(64),
    url: z.string().url().optional(),
    callback: z.string().max(128).optional(),
  })).max(10).nullable().optional(),
  isActive: z.boolean().optional(),
  variant: z.string().max(8).optional(),
  promoCode: z.string().max(64).nullable().optional(),
  promoLink: z.string().url().nullable().optional(),
});

const updateSchema = createSchema.partial().extend({
  id: z.number().int().positive(),
});

function firstError(err: z.ZodError): string {
  const flat = err.flatten().fieldErrors;
  return String(Object.values(flat).flat()[0] || 'Невалідні дані');
}

export const GET = withRole('admin', 'manager')(
  async () => {
    try {
      const messages = await prisma.botWelcomeMessage.findMany({
        orderBy: { platform: 'asc' },
      });
      return successResponse(messages);
    } catch (err) {
      logger.error('[admin/bot-welcome] GET failed', { error: err });
      return errorResponse('Помилка завантаження привітань', 500);
    }
  }
);

export const POST = withRole('admin', 'manager')(
  async (request: NextRequest) => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = createSchema.safeParse(body);
      if (!parsed.success) return errorResponse(firstError(parsed.error), 400);

      const msg = await prisma.botWelcomeMessage.create({
        data: {
          platform: parsed.data.platform,
          messageText: parsed.data.messageText,
          messageImage: parsed.data.messageImage ?? null,
          buttons: parsed.data.buttons ?? undefined,
          isActive: parsed.data.isActive ?? true,
          variant: parsed.data.variant || 'A',
          promoCode: parsed.data.promoCode ?? null,
          promoLink: parsed.data.promoLink ?? null,
        },
      });
      return successResponse(msg, 201);
    } catch (err) {
      logger.error('[admin/bot-welcome] POST failed', { error: err });
      return errorResponse('Помилка створення привітання', 500);
    }
  }
);

export const PUT = withRole('admin', 'manager')(
  async (request: NextRequest) => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = updateSchema.safeParse(body);
      if (!parsed.success) return errorResponse(firstError(parsed.error), 400);

      const { id, buttons, ...rest } = parsed.data;
      const msg = await prisma.botWelcomeMessage.update({
        where: { id },
        data: {
          ...rest,
          ...(buttons !== undefined ? { buttons: buttons ?? undefined } : {}),
        },
      });
      return successResponse(msg);
    } catch (err) {
      logger.error('[admin/bot-welcome] PUT failed', { error: err });
      return errorResponse('Помилка оновлення привітання', 500);
    }
  }
);

export const DELETE = withRole('admin')(
  async (request: NextRequest) => {
    try {
      const id = Number(request.nextUrl.searchParams.get('id'));
      if (!id || Number.isNaN(id)) return errorResponse('Невалідний ID', 400);
      await prisma.botWelcomeMessage.delete({ where: { id } });
      return successResponse({ deleted: true });
    } catch (err) {
      logger.error('[admin/bot-welcome] DELETE failed', { error: err });
      return errorResponse('Помилка видалення привітання', 500);
    }
  }
);
