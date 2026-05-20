import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getAdminReturns } from '@/services/return-request';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);
    const status = url.searchParams.get('status') || undefined;

    const { returns, total } = await getAdminReturns(page, limit, status);
    return successResponse({ returns, total, page, limit });
  } catch (err) {
    logger.error('[admin/returns] GET failed', { error: err });
    return errorResponse('Помилка сервера', 500);
  }
});
