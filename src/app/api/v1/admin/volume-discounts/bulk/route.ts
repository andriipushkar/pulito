import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { createVolumeDiscountsBulk } from '@/services/volume-pricing';
import { createVolumeDiscountSchema } from '@/validators/volume-discount';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

const bulkSchema = z.object({
  items: z.array(createVolumeDiscountSchema).min(1).max(200),
});

export const POST = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      // Prefix the row index (items.<n>.<field>) so the admin can find the bad
      // line in their pasted CSV instead of hunting through 200 rows.
      const where = issue?.path.length ? `Рядок ${issue.path.join('.')}: ` : '';
      return errorResponse(`${where}${issue?.message || 'Невалідні дані'}`, 400);
    }

    const result = await createVolumeDiscountsBulk(parsed.data.items);

    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'volume_discount',
      details: {
        bulk: true,
        submitted: parsed.data.items.length,
        created: result.created,
        failed: result.failed,
      },
    });

    return successResponse(result, 201);
  } catch (err) {
    logger.error('[admin/volume-discounts/bulk] POST failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
