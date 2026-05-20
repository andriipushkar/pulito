import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { generateForProduct } from '@/services/ai-content';

const schema = z.object({
  name: z.string().min(1).max(200),
  categoryId: z.number().int().positive().optional().nullable(),
  brandId: z.number().int().positive().optional().nullable(),
  priceRetail: z.number().min(0).optional(),
  shortDescription: z.string().max(500).optional().nullable(),
});

/**
 * Generate SEO content from in-progress form data — used on the
 * /admin/products/new page before a product row exists. Same payload contract
 * as /[id]/ai-generate but reads category/brand names from FK ids on the fly.
 */
export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const [category, brand] = await Promise.all([
      parsed.data.categoryId
        ? prisma.category.findUnique({
            where: { id: parsed.data.categoryId },
            select: { name: true },
          })
        : null,
      parsed.data.brandId
        ? prisma.brand.findUnique({
            where: { id: parsed.data.brandId },
            select: { name: true },
          })
        : null,
    ]);

    const generated = await generateForProduct({
      name: parsed.data.name,
      category: category?.name ?? null,
      brand: brand?.name ?? null,
      priceRetail: parsed.data.priceRetail ?? 0,
      shortDescription: parsed.data.shortDescription ?? null,
    });

    return successResponse(generated);
  } catch (error) {
    console.error('[AI generate-preview]', error);
    return errorResponse('Не вдалося згенерувати опис', 500);
  }
});
