import { withRole2fa } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { testChannelConnection, type ChannelType } from '@/services/channel-config';
import { logger } from '@/lib/logger';

const CHANNELS: ChannelType[] = ['telegram', 'viber', 'facebook', 'instagram', 'tiktok'];

export const POST = withRole2fa('admin')(async (req) => {
  try {
    const { channel, config } = await req.json();

    if (!channel || !CHANNELS.includes(channel)) {
      return errorResponse('Невідомий канал');
    }

    const result = await testChannelConnection(channel as ChannelType, config);
    return successResponse(result);
  } catch (err) {
    logger.error('[admin/channel-settings/test] POST failed', { error: err });
    return errorResponse('Помилка тестування з\'єднання', 500);
  }
});
