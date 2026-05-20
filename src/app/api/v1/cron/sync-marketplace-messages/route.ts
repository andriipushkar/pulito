import { NextRequest } from 'next/server';
import { syncMarketplaceMessages } from '@/services/marketplace-messages-sync';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { withCronLock } from '@/lib/cron-lock';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const locked = await withCronLock('sync-marketplace-messages', 600, async () => {
      return syncMarketplaceMessages();
    });

    if (!locked.acquired) {
      return successResponse({ skipped: true, reason: 'Previous run still in flight' });
    }
    return successResponse(locked.result);
  } catch {
    return errorResponse('Помилка синхронізації повідомлень', 500);
  }
}
