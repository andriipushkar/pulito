import { NextRequest } from 'next/server';
import {
  MARKETPLACE_PLATFORMS,
  runHealthCheck,
  maybeAlertLowUptime,
  type MarketplacePlatform,
} from '@/services/marketplace-health';
import { detectErrorPattern } from '@/services/marketplace-error-detector';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const results: Record<string, unknown> = {};

    // Run checks in parallel — each is rate-limited by the marketplace API
    await Promise.all(
      MARKETPLACE_PLATFORMS.map(async (platform: MarketplacePlatform) => {
        try {
          results[platform] = await runHealthCheck(platform);
        } catch (err) {
          results[platform] = {
            status: 'error',
            error: err instanceof Error ? err.message : 'unknown',
            checkedAt: new Date().toISOString(),
          };
        }
        // Check long-term uptime after every health check; alert if it's
        // been bad for a while (cooldown inside the helper prevents spam).
        try {
          await maybeAlertLowUptime(platform);
        } catch {
          // Alerting failure must not break the cron
        }
      }),
    );

    // Error-pattern detection across all platforms — fire-and-forget; uses
    // its own cooldown internally.
    let errorDetection: unknown = null;
    try {
      errorDetection = await detectErrorPattern();
    } catch {
      // Detection failure must not break the health route
    }

    return successResponse({ ...results, errorDetection });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
