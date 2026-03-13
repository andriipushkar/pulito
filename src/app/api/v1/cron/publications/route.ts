import { NextRequest } from 'next/server';
import { publishScheduledPublications } from '@/services/jobs/publish-scheduled';
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

    const result = await publishScheduledPublications();
    return successResponse({
      ...result,
      message: `Опубліковано: ${result.published}, помилок: ${result.failed}`,
    });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
