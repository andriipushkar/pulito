import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { getLinkedProducts, setProductMarkupOverride } from '@/services/suppliers/first-import';

/** List products linked to a channel (with their per-product markup override). */
export const GET = withRole(
  'manager',
  'admin',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    return successResponse(await getLinkedProducts(numId));
  } catch (err) {
    logger.error('[admin/supplier-channels/[id]/linked-products] GET failed', { error: err });
    return errorResponse('Не вдалося завантажити товари', 500);
  }
});

const patchSchema = z.object({
  productId: z.number().int().positive(),
  markupOverrideType: z.enum(['percent', 'fixed']).nullable(),
  markupOverrideValue: z.number().min(0).max(1_000_000).nullable(),
});

/** Set/clear a per-product markup override. */
export const PATCH = withRole('admin')(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const { productId, markupOverrideType, markupOverrideValue } = parsed.data;
    const res = await setProductMarkupOverride(
      numId,
      productId,
      markupOverrideType,
      markupOverrideValue,
    );
    if (!res.updated) return errorResponse('Товар не належить цьому каналу', 404);
    return successResponse(res);
  } catch (err) {
    logger.error('[admin/supplier-channels/[id]/linked-products] PATCH failed', { error: err });
    return errorResponse('Не вдалося оновити націнку', 500);
  }
});
