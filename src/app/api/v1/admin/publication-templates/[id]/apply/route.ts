import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { PublicationTemplateError, applyTemplate } from '@/services/publication-template';

export const POST = withRole(
  'admin',
  'manager',
)(async (request, ctx) => {
  const params = (await ctx.params) ?? {};
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return errorResponse('Невалідний ID', 400);

  try {
    const body = (await request.json().catch(() => ({}))) as { productId?: number | null };
    const productId =
      body.productId === undefined || body.productId === null ? null : Number(body.productId);
    if (productId !== null && !Number.isFinite(productId)) {
      return errorResponse('Невалідний productId', 400);
    }
    const result = await applyTemplate(id, productId);
    return successResponse(result);
  } catch (err) {
    if (err instanceof PublicationTemplateError) {
      return errorResponse(err.message, err.statusCode);
    }
    return errorResponse('Помилка застосування шаблону', 500);
  }
});
