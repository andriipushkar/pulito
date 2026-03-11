import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('admin', 'manager')(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const template = await prisma.emailTemplate.findUnique({ where: { id: numId } });
    if (!template) return errorResponse('Шаблон не знайдено', 404);

    return successResponse(template);
  } catch (error) {
    console.error('[Email Template Detail]', error);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PUT = withRole('admin')(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const existing = await prisma.emailTemplate.findUnique({ where: { id: numId } });
    if (!existing) return errorResponse('Шаблон не знайдено', 404);

    const body = await request.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};

    if ('subject' in body) data.subject = body.subject;
    if ('bodyHtml' in body) data.bodyHtml = body.bodyHtml;
    if ('bodyText' in body) data.bodyText = body.bodyText;
    if ('isActive' in body) data.isActive = body.isActive;
    if ('isMarketing' in body) data.isMarketing = body.isMarketing;

    if (Object.keys(data).length === 0) {
      return errorResponse('Немає даних для оновлення', 400);
    }

    // Save version history if content changed
    if (data.subject || data.bodyHtml) {
      await prisma.emailTemplateVersion.create({
        data: {
          templateId: numId,
          version: existing.version,
          subject: existing.subject,
          bodyHtml: existing.bodyHtml,
        },
      });
      data.version = existing.version + 1;
    }

    const template = await prisma.emailTemplate.update({
      where: { id: numId },
      data,
    });

    return successResponse(template);
  } catch (error) {
    console.error('[Email Template Update]', error);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withRole('admin')(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    await prisma.emailTemplate.delete({ where: { id: numId } });
    return successResponse({ deleted: true });
  } catch (error) {
    console.error('[Email Template Delete]', error);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
