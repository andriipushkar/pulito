import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, privateResponse, errorResponse } from '@/utils/api-response';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

const upsertNoteSchema = z.object({
  productId: z.number().int().positive(),
  // 2000 chars is generous; pre-fix cap of 500 was a UX limit, not a
  // security one. The hard guard is to stop a 10 MB body landing in
  // product_notes via a malicious client.
  noteText: z.string().min(1).max(2000),
});

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
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.cart);
    if (!rl.allowed) {
      return errorResponse('Забагато запитів. Спробуйте пізніше.', 429);
    }

    const body = await request.json();
    const parsed = upsertNoteSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const { productId, noteText } = parsed.data;

    // Refuse to create a note for a non-existent product (FK would
    // bubble up as an unfriendly Prisma error; check explicitly).
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) return errorResponse('Товар не знайдено', 404);

    const note = await prisma.productNote.upsert({
      where: {
        userId_productId: { userId: user.id, productId },
      },
      update: { noteText },
      create: {
        userId: user.id,
        productId,
        noteText,
      },
    });

    return successResponse(note, 201);
  } catch {
    return errorResponse('Помилка збереження нотатки', 500);
  }
});
