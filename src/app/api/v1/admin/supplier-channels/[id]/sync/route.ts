import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { syncSupplierChannel, SupplierChannelError } from '@/services/supplier-channel';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';

    const { result } = await syncSupplierChannel(numId, user.id, { dryRun });

    if (!dryRun) {
      await logAudit({
        userId: user.id,
        actionType: 'import_action',
        entityType: 'supplier_channel',
        entityId: numId,
        details: {
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          variantsCreated: result.variantsCreated ?? 0,
          variantsUpdated: result.variantsUpdated ?? 0,
        },
        ipAddress: getClientIp(request),
      });
    }

    return successResponse(result);
  } catch (err) {
    if (err instanceof SupplierChannelError) return errorResponse(err.message, err.statusCode);
    logger.error('[admin/supplier-channels/[id]/sync] POST failed', { error: err });
    return errorResponse('Не вдалося синхронізувати', 500);
  }
});
