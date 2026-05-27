import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { startImpersonation, ImpersonationError } from '@/services/impersonation';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export const POST = withRole2fa('admin')(async (
  request: NextRequest,
  { params, user: adminUser },
) => {
  try {
    // Impersonation is a privileged surface — capped to the `sensitive`
    // bucket (3 per 15 min per admin). Stops a stolen session from
    // enumerating valid user IDs via the error-message side channel
    // ("user not found" vs "cannot impersonate admin") at brute-force
    // speeds. Each successful impersonation still leaves an audit row.
    const rl = await checkRateLimit(`user:${adminUser!.id}`, RATE_LIMITS.sensitive);
    if (!rl.allowed) {
      return errorResponse(`Забагато спроб імперсонації. Спробуйте через ${rl.retryAfter} с.`, 429);
    }

    const { id } = await params!;
    const targetId = Number(id);
    if (isNaN(targetId)) return errorResponse('Невалідний ID', 400);

    const result = await startImpersonation(adminUser!.id, targetId, getClientIp(request));
    return successResponse(result);
  } catch (error) {
    if (error instanceof ImpersonationError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/users/[id]/impersonate] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
