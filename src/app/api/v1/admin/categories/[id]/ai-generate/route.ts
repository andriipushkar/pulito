import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { generateForCategory } from '@/services/ai-content';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

const bodySchema = z.object({
  provider: z.enum(['claude', 'gemini', 'rules']).optional(),
});

/**
 * Generate category SEO content using fields already saved in DB
 * (parent name + product count + top brands of products in this category).
 */
export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params, user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminAiGenerate);
    if (!rl.allowed) {
      return errorResponse(
        `Ліміт AI-генерації вичерпано. Спробуйте через ${rl.retryAfter} с.`,
        429,
      );
    }
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    const provider = parsed.success ? parsed.data.provider : undefined;

    const category = await prisma.category.findUnique({
      where: { id: numId },
      select: {
        name: true,
        parent: { select: { name: true } },
        _count: { select: { products: { where: { isActive: true } } } },
      },
    });
    if (!category) return errorResponse('Категорію не знайдено', 404);

    // Pull the top brands of products in this category so the LLM can ground
    // brand-specific copy in reality (instead of inventing brands).
    const brandRows = await prisma.product.groupBy({
      by: ['brandId'],
      where: { categoryId: numId, isActive: true, brandId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { brandId: 'desc' } },
      take: 6,
    });
    const brandIds = brandRows.map((b) => b.brandId).filter((id): id is number => id !== null);
    const brands = brandIds.length
      ? await prisma.brand.findMany({
          where: { id: { in: brandIds } },
          select: { id: true, name: true },
        })
      : [];
    const brandNameById = new Map(brands.map((b) => [b.id, b.name]));
    const topBrands = brandIds.map((id) => brandNameById.get(id)).filter((n): n is string => !!n);

    const generated = await generateForCategory(
      {
        name: category.name,
        parentName: category.parent?.name ?? null,
        productCount: category._count.products,
        topBrands,
      },
      { provider },
    );

    return successResponse(generated);
  } catch (error) {
    console.error('[AI category generate]', error);
    return errorResponse('Не вдалося згенерувати опис категорії', 500);
  }
});
