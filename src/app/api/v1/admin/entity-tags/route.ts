import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

const ALLOWED_TYPES = new Set(['order', 'product', 'user']);

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const entityType = url.searchParams.get('entityType');
    const entityId = url.searchParams.get('entityId');
    if (!entityType || !entityId || !ALLOWED_TYPES.has(entityType)) {
      return errorResponse('Очікуються entityType та entityId', 400);
    }
    const numId = Number(entityId);
    if (isNaN(numId)) return errorResponse('Невалідний entityId', 400);
    const rows = await prisma.entityTag.findMany({
      where: { entityType, entityId: numId },
      include: { tag: true },
    });
    return successResponse(rows.map((r) => r.tag));
  } catch (error) {
    console.error('[Entity tags GET]', error);
    return errorResponse('Помилка', 500);
  }
});

export const POST = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const entityType = String(body.entityType ?? '');
    const entityId = Number(body.entityId);
    const tagId = Number(body.tagId);
    if (!ALLOWED_TYPES.has(entityType) || isNaN(entityId) || isNaN(tagId)) {
      return errorResponse('Невалідні параметри', 400);
    }
    const created = await prisma.entityTag.upsert({
      where: { tagId_entityType_entityId: { tagId, entityType, entityId } },
      update: {},
      create: { tagId, entityType, entityId },
      include: { tag: true },
    });
    return successResponse(created.tag, 201);
  } catch (error) {
    console.error('[Entity tags POST]', error);
    return errorResponse('Помилка', 500);
  }
});

export const DELETE = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const entityType = url.searchParams.get('entityType') ?? '';
    const entityId = Number(url.searchParams.get('entityId') ?? '');
    const tagId = Number(url.searchParams.get('tagId') ?? '');
    if (!ALLOWED_TYPES.has(entityType) || isNaN(entityId) || isNaN(tagId)) {
      return errorResponse('Невалідні параметри', 400);
    }
    await prisma.entityTag.deleteMany({
      where: { tagId, entityType, entityId },
    });
    return successResponse({ ok: true });
  } catch (error) {
    console.error('[Entity tags DELETE]', error);
    return errorResponse('Помилка', 500);
  }
});
