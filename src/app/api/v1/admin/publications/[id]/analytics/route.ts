import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { syncPublicationAnalytics } from '@/services/publication';
import { successResponse, errorResponse } from '@/utils/api-response';

export const POST = withRole('admin', 'manager')(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const results = await syncPublicationAnalytics(numId);
    return successResponse(results);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
