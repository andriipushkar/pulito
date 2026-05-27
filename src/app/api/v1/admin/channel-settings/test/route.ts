import { z } from 'zod';
import { withRole2fa } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { testChannelConnection, type ChannelType } from '@/services/channel-config';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

const CHANNELS = [
  'telegram',
  'viber',
  'facebook',
  'instagram',
  'tiktok',
  'olx',
  'rozetka',
  'prom',
  'epicentrk',
] as const;

const bodySchema = z.object({
  channel: z.enum(CHANNELS),
  // Accept the channel-specific config object. Each test branch reads only its
  // own fields; we don't `.passthrough()` arbitrary keys to keep payload bounded.
  config: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])),
});

export const POST = withRole2fa('admin')(async (req, { user }) => {
  try {
    // Each test fires an external API call carrying admin-supplied credentials.
    // Reuse the payment-test bucket (5/min per admin) so a stuck UI button or
    // a stolen session can't burn through Telegram/Facebook rate limits.
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminPaymentTest);
    if (!rl.allowed) {
      return errorResponse(`Забагато перевірок з’єднання. Спробуйте через ${rl.retryAfter}с.`, 429);
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const result = await testChannelConnection(
      parsed.data.channel as ChannelType,
      parsed.data.config as never,
    );

    // External system probe is auditable — credential validity check is a
    // sensitive forensic event (was admin testing a stolen key?).
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'channel_test',
      details: {
        action: 'test',
        channel: parsed.data.channel,
        success: result.success,
        name: result.name ?? null,
      },
      ipAddress: getClientIp(req),
    });

    return successResponse(result);
  } catch (err) {
    logger.error('[admin/channel-settings/test] POST failed', { error: err });
    return errorResponse("Помилка тестування з'єднання", 500);
  }
});
