import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { fetchTopSentryIssues } from '@/services/sentry-issues';
import { getSlowQueries } from '@/services/slow-queries';
import { getRecentDeployments } from '@/services/deployment-history';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole2fa('admin')(async (_request: NextRequest) => {
  try {
    const [sentry, slowQueries, deployments] = await Promise.all([
      fetchTopSentryIssues(10),
      getSlowQueries(10),
      getRecentDeployments(10),
    ]);
    return successResponse({ sentry, slowQueries, deployments });
  } catch (err) {
    logger.error('[admin/health] GET failed', { error: err });
    return errorResponse('Помилка завантаження стану системи', 500);
  }
});
