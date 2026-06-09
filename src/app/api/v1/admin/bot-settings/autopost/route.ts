import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole, withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

// Telegram promo autopost schedule, edited from /admin/bot-settings.
// A fixed hourly cron (crontab) is the heartbeat; THIS config decides whether
// to actually post and in which hours (Europe/Kyiv), so the schedule lives in
// the admin panel instead of crontab.
const AUTOPOST_KEY = 'telegram_autopost';

const autopostSchema = z.object({
  enabled: z.boolean(),
  // Hours of day (0–23, Europe/Kyiv) at which a post run fires. Deduped + sorted.
  hours: z
    .array(z.number().int().min(0).max(23))
    .max(24)
    .transform((h) => Array.from(new Set(h)).sort((a, b) => a - b)),
  // Products published per run (Telegram-side dedup keeps each ≤1×/30d).
  batchSize: z.number().int().min(1).max(20),
  // Content types to publish.
  postPromo: z.boolean().default(true),
  postNew: z.boolean().default(false),
});

const DEFAULTS = { enabled: false, hours: [11], batchSize: 5, postPromo: true, postNew: false };

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: AUTOPOST_KEY } });
    const config = setting ? { ...DEFAULTS, ...JSON.parse(setting.value) } : DEFAULTS;
    return successResponse(config);
  } catch (err) {
    logger.error('[admin/bot-settings/autopost] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PUT = withRole2fa('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = autopostSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }

    await prisma.siteSetting.upsert({
      where: { key: AUTOPOST_KEY },
      create: { key: AUTOPOST_KEY, value: JSON.stringify(parsed.data), updatedBy: user.id },
      update: { value: JSON.stringify(parsed.data), updatedBy: user.id },
    });

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'telegram_autopost',
      details: parsed.data,
    });

    return successResponse(parsed.data);
  } catch (err) {
    logger.error('[admin/bot-settings/autopost] PUT failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
