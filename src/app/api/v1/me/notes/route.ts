import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, privateResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (_request, { user }) => {
  try {
    const notes = await prisma.productNote.findMany({
      where: { userId: user.id },
      include: {
        product: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return privateResponse(notes);
  } catch {
    return errorResponse('Помилка завантаження нотаток', 500);
  }
});

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const { productId, noteText } = await request.json();

    if (!productId || !noteText) {
      return errorResponse("productId та noteText обов'язкові", 400);
    }

    if (noteText.length > 500) {
      return errorResponse('Максимум 500 символів', 400);
    }

    const note = await prisma.productNote.upsert({
      where: {
        userId_productId: { userId: user.id, productId: Number(productId) },
      },
      update: { noteText },
      create: {
        userId: user.id,
        productId: Number(productId),
        noteText,
      },
    });

    return successResponse(note, 201);
  } catch {
    return errorResponse('Помилка збереження нотатки', 500);
  }
});
