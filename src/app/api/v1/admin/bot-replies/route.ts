import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

const createSchema = z.object({
  triggerText: z.string().min(1).max(500).nullable().optional(),
  responseText: z.string().min(1).max(4000),
  // Must match what bot-auto-reply.ts checks. An unknown triggerType means
  // the rule will never fire — but the admin would see it as "active".
  triggerType: z.enum(['partial', 'exact', 'regex']).default('partial'),
  platform: z.enum(['all', 'telegram', 'viber', 'instagram', 'facebook']).default('all'),
  priority: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
});

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const replies = await prisma.botAutoReply.findMany({
      orderBy: { priority: 'asc' },
    });
    return successResponse(replies);
  } catch (err) {
    logger.error('[admin/bot-replies] GET failed', { error: err });
    return errorResponse('Помилка завантаження авто-відповідей', 500);
  }
});

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? 'Невалідні дані', 422);
    }
    const reply = await prisma.botAutoReply.create({
      data: {
        triggerText: parsed.data.triggerText ?? null,
        responseText: parsed.data.responseText,
        triggerType: parsed.data.triggerType,
        platform: parsed.data.platform,
        priority: parsed.data.priority,
        isActive: parsed.data.isActive,
      },
    });
    // Auto-reply content fires at customers — phishing/scam reply has
    // to leave a creator-trail for compliance.
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'bot_auto_reply',
      entityId: reply.id,
      details: {
        platform: parsed.data.platform,
        triggerType: parsed.data.triggerType,
      },
      ipAddress: getClientIp(request),
    });
    return successResponse(reply, 201);
  } catch (err) {
    logger.error('[admin/bot-replies] POST failed', { error: err });
    return errorResponse('Помилка створення авто-відповіді', 500);
  }
});
