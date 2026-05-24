import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const PUT = withAuth(
  async (
    request: NextRequest,
    { user, params }: { user: { id: number }; params?: Promise<Record<string, string>> },
  ) => {
    try {
      const resolved = (await params) ?? {};
      const productId = Number(resolved.productId);
      if (!Number.isFinite(productId) || productId <= 0) {
        return errorResponse('Невалідний productId', 400);
      }
      const { noteText } = await request.json();
      if (typeof noteText !== 'string' || !noteText.trim()) {
        return errorResponse('noteText обовʼязковий', 400);
      }
      if (noteText.length > 500) {
        return errorResponse('Максимум 500 символів', 400);
      }

      const updated = await prisma.productNote.update({
        where: { userId_productId: { userId: user.id, productId } },
        data: { noteText },
      });
      return successResponse(updated);
    } catch {
      return errorResponse('Помилка оновлення нотатки', 500);
    }
  },
);

export const DELETE = withAuth(
  async (
    _request: NextRequest,
    { user, params }: { user: { id: number }; params?: Promise<Record<string, string>> },
  ) => {
    try {
      const resolved = (await params) ?? {};
      const productId = Number(resolved.productId);
      if (!Number.isFinite(productId) || productId <= 0) {
        return errorResponse('Невалідний productId', 400);
      }
      await prisma.productNote.delete({
        where: { userId_productId: { userId: user.id, productId } },
      });
      return successResponse({ deleted: true });
    } catch {
      return errorResponse('Помилка видалення нотатки', 500);
    }
  },
);
