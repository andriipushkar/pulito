import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import {
  PublicationTemplateError,
  deleteTemplate,
  getTemplate,
  updateTemplate,
} from '@/services/publication-template';

async function readId(ctx: { params?: Promise<Record<string, string>> }): Promise<number | null> {
  const params = (await ctx.params) ?? {};
  const id = Number(params.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export const GET = withRole(
  'admin',
  'manager',
)(async (_request, ctx) => {
  const id = await readId(ctx);
  if (!id) return errorResponse('Невалідний ID', 400);
  try {
    const tpl = await getTemplate(id);
    return successResponse(tpl);
  } catch (err) {
    if (err instanceof PublicationTemplateError) {
      return errorResponse(err.message, err.statusCode);
    }
    return errorResponse('Помилка завантаження шаблону', 500);
  }
});

export const PUT = withRole(
  'admin',
  'manager',
)(async (request, ctx) => {
  const id = await readId(ctx);
  if (!id) return errorResponse('Невалідний ID', 400);
  try {
    const body = await request.json();
    const tpl = await updateTemplate(id, body);
    return successResponse(tpl);
  } catch (err) {
    if (err instanceof PublicationTemplateError) {
      return errorResponse(err.message, err.statusCode);
    }
    return errorResponse('Помилка оновлення шаблону', 500);
  }
});

export const DELETE = withRole(
  'admin',
  'manager',
)(async (_request, ctx) => {
  const id = await readId(ctx);
  if (!id) return errorResponse('Невалідний ID', 400);
  try {
    await deleteTemplate(id);
    return successResponse({ deleted: true });
  } catch (err) {
    if (err instanceof PublicationTemplateError) {
      return errorResponse(err.message, err.statusCode);
    }
    return errorResponse('Помилка видалення шаблону', 500);
  }
});
