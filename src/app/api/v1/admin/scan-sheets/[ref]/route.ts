import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getScanSheet, NovaPoshtaError } from '@/services/nova-poshta';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

// Get one registry (with its documents) by Ref.
export const GET = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { params }) => {
  try {
    const { ref } = await params!;
    if (!ref) return errorResponse('Не вказано Ref реєстру', 400);
    const data = await getScanSheet({ ref });
    return successResponse(data);
  } catch (error) {
    if (error instanceof NovaPoshtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/scan-sheets/[ref]] GET failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
