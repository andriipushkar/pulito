import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { createPublication, getPublications, PublicationError } from '@/services/publication';
import { successResponse, paginatedResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const { publications, total } = await getPublications({
      page: Number(params.page) || 1,
      limit: Number(params.limit) || 20,
      status: params.status || undefined,
    });
    return paginatedResponse(publications, total, Number(params.page) || 1, Number(params.limit) || 20);
  } catch (err) {
    logger.error('[admin/publications] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole('admin', 'manager')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const pub = await createPublication(body, user.id);
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'publication',
      entityId: pub.id,
    });
    return successResponse(pub, 201);
  } catch (error) {
    if (error instanceof PublicationError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/publications] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
