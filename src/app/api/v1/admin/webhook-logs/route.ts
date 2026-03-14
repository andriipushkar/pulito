import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getWebhookLogs } from '@/services/webhook-log';
import { paginatedResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('admin')(async (request: NextRequest) => {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const { logs, total } = await getWebhookLogs({
      source: params.source || undefined,
      page: Number(params.page) || 1,
      limit: Number(params.limit) || 50,
    });
    return paginatedResponse(logs, total, Number(params.page) || 1, Number(params.limit) || 50);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
