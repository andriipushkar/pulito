import { withRole } from '@/middleware/auth';
import { getConnectionStatus } from '@/services/marketplace-sync';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('admin', 'manager')(
  async () => {
    try {
      const platforms = ['rozetka', 'prom'] as const;
      const connections = await Promise.all(
        platforms.map((platform) => getConnectionStatus(platform))
      );
      return successResponse(connections);
    } catch {
      return errorResponse('Помилка завантаження підключень маркетплейсів', 500);
    }
  }
);
