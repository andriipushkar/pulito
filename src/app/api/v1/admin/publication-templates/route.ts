import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import {
  PublicationTemplateError,
  createTemplate,
  listTemplates,
} from '@/services/publication-template';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get('active') === '1';
    const templates = await listTemplates(activeOnly);
    return successResponse(templates);
  } catch {
    return errorResponse('Помилка завантаження шаблонів', 500);
  }
});

export const POST = withRole(
  'admin',
  'manager',
)(async (request, ctx) => {
  try {
    const body = await request.json();
    const tpl = await createTemplate(body, ctx.user.id);
    return successResponse(tpl, 201);
  } catch (err) {
    if (err instanceof PublicationTemplateError) {
      return errorResponse(err.message, err.statusCode);
    }
    return errorResponse('Помилка створення шаблону', 500);
  }
});
