import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { processReturn, markReturnReceived, markReturnRefunded, ReturnError } from '@/services/return-request';
import { processReturnSchema } from '@/validators/return-request';
import { successResponse, errorResponse } from '@/utils/api-response';

export const PATCH = withRole('admin', 'manager')(async (request: NextRequest, { user, params }) => {
  try {
    const { id } = await params!;
    const returnId = Number(id);
    if (!returnId) return errorResponse('Невірний ID', 400);

    const body = await request.json();

    // Mark as received
    if (body.action === 'received') {
      const result = await markReturnReceived(returnId);
      return successResponse(result);
    }

    // Mark as refunded
    if (body.action === 'refunded') {
      const result = await markReturnRefunded(returnId);
      return successResponse(result);
    }

    // Process (approve/reject)
    const parsed = processReturnSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);

    const result = await processReturn(returnId, parsed.data.status, parsed.data.adminComment, user.id);
    return successResponse(result);
  } catch (error) {
    if (error instanceof ReturnError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Помилка сервера', 500);
  }
});
