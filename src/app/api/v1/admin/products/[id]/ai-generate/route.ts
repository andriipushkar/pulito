import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { generateForProduct } from '@/services/ai-content';

/**
 * Generates SEO content (title, description, short, full) from the product's
 * existing fields. Returns the suggestion — does NOT save. The UI shows the
 * draft so the owner can edit before clicking "Save".
 */
export const POST = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const product = await prisma.product.findUnique({
      where: { id: numId },
      select: {
        name: true,
        priceRetail: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
        content: { select: { shortDescription: true } },
      },
    });
    if (!product) return errorResponse('Товар не знайдено', 404);

    const generated = await generateForProduct({
      name: product.name,
      category: product.category?.name ?? null,
      brand: product.brand?.name ?? null,
      priceRetail: Number(product.priceRetail),
      shortDescription: product.content?.shortDescription ?? null,
    });

    return successResponse(generated);
  } catch (error) {
    console.error('[AI generate]', error);
    return errorResponse('Не вдалося згенерувати опис', 500);
  }
});
