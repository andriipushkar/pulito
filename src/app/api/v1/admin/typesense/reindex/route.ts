import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { indexAllProducts, isTypesenseAvailable } from '@/services/typesense';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

// Admin-triggered Typesense full reindex. The cron route at
// /api/v1/cron/reindex-products does the same thing but needs APP_SECRET
// bearer — this one is RBAC-gated so operators can hit it from the UI
// after a schema change or any time the index drifts from the DB.
export const POST = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest) => {
  try {
    const available = await isTypesenseAvailable();
    if (!available) {
      return errorResponse('Typesense недоступний', 503);
    }
    const result = await indexAllProducts();
    return successResponse(result);
  } catch (err) {
    logger.error('Admin reindex failed', { error: String(err) });
    return errorResponse('Помилка індексації', 500);
  }
});
