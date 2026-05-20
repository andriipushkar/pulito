import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  getAutoCrosslistSettings,
  saveAutoCrosslistSettings,
  runAutoCrosslist,
} from '@/services/marketplace-auto-crosslist';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(async () => {
  try {
    const settings = await getAutoCrosslistSettings();
    return successResponse(settings);
  } catch (err) {
    logger.error('[admin/marketplaces/auto-crosslist] GET failed', { error: err });
    return errorResponse('Помилка завантаження', 500);
  }
});

export const PUT = withRole('admin')(async (req: NextRequest) => {
  try {
    const body = (await req.json()) as {
      enabled?: boolean;
      windowDays?: number;
      excludePlatforms?: string[];
    };
    await saveAutoCrosslistSettings({
      enabled: !!body.enabled,
      windowDays: Number(body.windowDays) || 7,
      excludePlatforms: Array.isArray(body.excludePlatforms) ? body.excludePlatforms : [],
    });
    return successResponse({ saved: true });
  } catch (err) {
    logger.error('[admin/marketplaces/auto-crosslist] PUT failed', { error: err });
    return errorResponse('Помилка збереження', 500);
  }
});

// Manually trigger a run (useful for testing settings without waiting for cron).
export const POST = withRole('admin')(async () => {
  try {
    const report = await runAutoCrosslist();
    return successResponse(report);
  } catch (err) {
    logger.error('[admin/marketplaces/auto-crosslist] POST failed', { error: err });
    return errorResponse('Помилка запуску', 500);
  }
});
