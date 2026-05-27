import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { generateForProduct } from '@/services/ai-content';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

const schema = z.object({
  name: z.string().min(1).max(200),
  categoryId: z.number().int().positive().optional().nullable(),
  brandId: z.number().int().positive().optional().nullable(),
  priceRetail: z.number().min(0).optional(),
  shortDescription: z.string().max(500).optional().nullable(),
  provider: z.enum(['claude', 'gemini', 'rules']).optional(),
});

/**
 * Generate SEO content from in-progress form data — used on the
 * /admin/products/new page before a product row exists. Same payload contract
 * as /[id]/ai-generate but reads category/brand names from FK ids on the fly.
 */
export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    // Shares the per-user AI quota with /[id]/ai-generate so a malicious or
    // stuck client can't bypass the limit by switching endpoints.
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminAiGenerate);
    if (!rl.allowed) {
      return errorResponse(
        `Ліміт AI-генерації вичерпано. Спробуйте через ${rl.retryAfter} с.`,
        429,
      );
    }

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

    const generated = await generateForProduct(
      {
        name: parsed.data.name,
        category: category?.name ?? null,
        brand: brand?.name ?? null,
        priceRetail: parsed.data.priceRetail ?? 0,
        shortDescription: parsed.data.shortDescription ?? null,
      },
      { provider: parsed.data.provider },
    );

    return successResponse(generated);
  } catch (error) {
    console.error('[AI generate-preview]', error);
    return errorResponse('Не вдалося згенерувати опис', 500);
  }
});
