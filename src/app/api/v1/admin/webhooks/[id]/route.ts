import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const PATCH = withRole('admin')(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = (await request.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (typeof body.name === 'string') data.name = body.name.trim();
    if (typeof body.url === 'string') data.url = body.url.trim();
    if ('events' in body && Array.isArray(body.events)) {
      data.events = body.events.filter((e): e is string => typeof e === 'string');
    }
    if ('isActive' in body) data.isActive = Boolean(body.isActive);
    const updated = await prisma.webhookSubscription.update({ where: { id: numId }, data });
    return successResponse(updated);
  } catch (error) {
    console.error('[Webhook PATCH]', error);
    return errorResponse('Помилка', 500);
  }
});

export const DELETE = withRole('admin')(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    await prisma.webhookSubscription.delete({ where: { id: numId } });
    return successResponse({ ok: true });
  } catch (error) {
    console.error('[Webhook DELETE]', error);
    return errorResponse('Помилка', 500);
  }
});
