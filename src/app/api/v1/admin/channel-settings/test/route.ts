import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { testChannelConnection, type ChannelType } from '@/services/channel-config';

const CHANNELS: ChannelType[] = ['telegram', 'viber', 'facebook', 'instagram', 'tiktok'];

export const POST = withRole('admin')(async (req) => {
  try {
    const { channel, config } = await req.json();

    if (!channel || !CHANNELS.includes(channel)) {
      return errorResponse('Невідомий канал');
    }

    const result = await testChannelConnection(channel as ChannelType, config);
    return successResponse(result);
  } catch {
    return errorResponse('Помилка тестування з\'єднання', 500);
  }
});
