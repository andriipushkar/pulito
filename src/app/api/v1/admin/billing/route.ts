import { withRole2fa } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getBilling, checkUsageLimits, BillingError } from '@/services/billing';
import { resolveActiveTenantId } from '@/lib/admin-tenant';
import { logger } from '@/lib/logger';

export const GET = withRole2fa('admin')(async (request, { user }) => {
  try {
    // Use the shared resolver — falling back to `tenantUser.findFirst`
    // would grab a random membership for users who belong to >1 tenant,
    // letting one admin read or mutate another tenant's billing.
    const resolved = await resolveActiveTenantId(request, user.id);
    if ('error' in resolved) return resolved.error;

    const billing = await getBilling(resolved.tenantId);
    const usage = await checkUsageLimits(resolved.tenantId);

    return successResponse({ billing, usage });
  } catch (error) {
    if (error instanceof BillingError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/billing] GET failed', { error });
    return errorResponse('Помилка завантаження біллінгу', 500);
  }
});
