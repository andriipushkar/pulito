import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { generateImageAltText } from '@/services/ai-content';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

const schema = z.object({
  provider: z.enum(['claude', 'gemini', 'rules']).optional(),
  // If true, overwrite existing altText; otherwise only fill blanks.
  overwrite: z.boolean().optional(),
});

/**
 * Bulk-generate AI alt-text for all images of a product. Cheap to run
 * (~$0.0001 per image on Gemini Flash). Used by the admin product page
 * "✨ Згенерувати alt-тексти" button.
 */
export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return errorResponse('Невалідні дані', 422);

    const product = await prisma.product.findUnique({
      where: { id: numId },
      select: {
        name: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
        images: { orderBy: { sortOrder: 'asc' }, select: { id: true, altText: true } },
      },
    });
    if (!product) return errorResponse('Товар не знайдено', 404);

    const total = product.images.length;
    let updated = 0;
    for (let i = 0; i < product.images.length; i++) {
      const img = product.images[i];
      if (!parsed.data.overwrite && img.altText && img.altText.trim()) continue;
      try {
        const alt = await generateImageAltText(
          {
            productName: product.name,
            brand: product.brand?.name ?? null,
            category: product.category?.name ?? null,
            imageIndex: i,
            totalImages: total,
          },
          { provider: parsed.data.provider },
        );
        await prisma.productImage.update({
          where: { id: img.id },
          data: { altText: alt },
        });
        updated++;
      } catch (err) {
        logger.warn('[admin/products/auto-alt] image failed', {
          imageId: img.id,
          error: String(err),
        });
      }
    }
    return successResponse({ total, updated });
  } catch (err) {
    logger.error('[admin/products/auto-alt] failed', { error: err });
    return errorResponse('Помилка генерації', 500);
  }
});
