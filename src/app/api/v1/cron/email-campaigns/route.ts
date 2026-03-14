import { NextRequest } from 'next/server';
import { processWelcomeEmails, processWeeklyDigest } from '@/services/jobs/email-campaigns';
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

    const type = request.nextUrl.searchParams.get('type') || 'welcome';

    let result;
    switch (type) {
      case 'welcome':
        result = await processWelcomeEmails();
        break;
      case 'digest':
        result = await processWeeklyDigest();
        break;
      default:
        return errorResponse('Невідомий тип розсилки', 400);
    }
    return successResponse(result);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
