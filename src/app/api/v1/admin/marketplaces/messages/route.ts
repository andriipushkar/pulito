import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getMarketplaceMessages } from '@/services/marketplaces';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('admin', 'manager')(
  async (request: NextRequest) => {
    try {
      const channel = request.nextUrl.searchParams.get('channel');

      if (!channel) {
        // Get messages from all configured marketplaces
        const allMessages = await Promise.all([
          getMarketplaceMessages('olx'),
          getMarketplaceMessages('rozetka'),
          getMarketplaceMessages('prom'),
        ]);
        const merged = allMessages.flat().sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return successResponse(merged);
      }

      const messages = await getMarketplaceMessages(channel);
      return successResponse(messages);
    } catch {
      return errorResponse('Помилка завантаження повідомлень', 500);
    }
  }
);
