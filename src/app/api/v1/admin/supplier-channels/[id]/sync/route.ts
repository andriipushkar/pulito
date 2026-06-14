import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { SupplierChannelError } from '@/services/supplier-channel';
import { runSupplierSync } from '@/services/suppliers/dispatch';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { params, user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminSupplierSync);
    if (!rl.allowed) {
      return errorResponse(
        `Забагато синхронізацій. Спробуйте через ${Math.ceil(rl.retryAfter / 60)} хв.`,
        429,
      );
    }

    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';

    const run = await runSupplierSync(numId, user.id, { dryRun });

    if (!dryRun) {
      await logAudit({
        userId: user.id,
        actionType: 'import_action',
        entityType: 'supplier_channel',
        entityId: numId,
        details: {
          mode: run.mode,
          created: run.created,
          updated: run.updated,
          skipped: run.skipped,
          variantsCreated: run.variantsCreated,
          variantsUpdated: run.variantsUpdated,
          matched: run.matched,
          unmatched: run.unmatched,
          priceChanged: run.priceChanged,
        },
        ipAddress: getClientIp(request),
      });
    }

    return successResponse(run);
  } catch (err) {
    if (err instanceof SupplierChannelError) return errorResponse(err.message, err.statusCode);
    logger.error('[admin/supplier-channels/[id]/sync] POST failed', { error: err });
    return errorResponse('Не вдалося синхронізувати', 500);
  }
});
