import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole } from '@/middleware/auth';
import { updateProductSchema } from '@/validators/product';
import { getProductById, updateProduct, deleteProduct, ProductError } from '@/services/product';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'manager',
  'admin',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const product = await getProductById(numId);

    if (!product) {
      return errorResponse('Товар не знайдено', 404);
    }

    return successResponse(product);
  } catch (err) {
    logger.error('[admin/products/[id]] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
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
    const parsed = updateProductSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Невалідні дані';
      return errorResponse(firstError, 422);
    }

    const product = await updateProduct(numId, parsed.data);

    // Audit before revalidation so the trail captures the actor even when
    // ISR refresh fails downstream.
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'product',
      entityId: numId,
      details: { fields: Object.keys(parsed.data) },
      ipAddress: getClientIp(request),
    });

    // On-demand revalidation: refresh cached product and catalog pages
    try {
      revalidatePath(`/product/${product.slug}`);
      revalidatePath('/catalog');
      revalidatePath('/');
    } catch {
      /* revalidation is best-effort */
    }

    // Update Typesense index
    import('@/services/typesense').then((ts) => ts.indexProduct(numId)).catch(() => {});

    return successResponse(product);
  } catch (error) {
    if (error instanceof ProductError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/products/[id]] PUT failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const result = await deleteProduct(numId);

    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'product',
      entityId: numId,
      details: { hard: result.hard },
      ipAddress: getClientIp(request),
    });

    try {
      revalidatePath('/catalog');
      revalidatePath('/');
      revalidatePath('/sitemap.xml');
    } catch {
      /* best-effort */
    }

    // For hard-deleted products also remove the Typesense doc; otherwise
    // re-index in deactivated state so the storefront stops showing it.
    import('@/services/typesense')
      .then((ts) => (result.hard ? ts.removeProductFromIndex(numId) : ts.indexProduct(numId)))
      .catch(() => {});

    return successResponse({
      hard: result.hard,
      message: result.hard
        ? 'Товар видалено'
        : 'Товар містить пов’язані замовлення — позначено як видалений',
    });
  } catch (error) {
    if (error instanceof ProductError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/products/[id]] DELETE failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
