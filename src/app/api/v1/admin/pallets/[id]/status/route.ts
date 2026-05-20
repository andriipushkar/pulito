import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { setPalletStatus, PalletError } from '@/services/pallet';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

const schema = z.object({
  status: z.enum(['forming', 'in_transit', 'delivered', 'cancelled']),
  // Operator override for the "still unpacked" guard — set from UI confirm
  // dialog after the admin acknowledges the warning.
  forceUnpacked: z.boolean().optional(),
});

export const PUT = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const pallet = await setPalletStatus(numId, parsed.data.status, {
      forceUnpacked: parsed.data.forceUnpacked,
    });

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'pallet',
      entityId: numId,
      details: { status: parsed.data.status },
      ipAddress: getClientIp(request),
    });

    return successResponse(pallet);
  } catch (err) {
    if (err instanceof PalletError) return errorResponse(err.message, err.statusCode);
    logger.error('[admin/pallets/[id]/status] PUT failed', { error: err });
    return errorResponse('Не вдалося оновити статус', 500);
  }
});
