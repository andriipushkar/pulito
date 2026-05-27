import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { generateForProduct } from '@/services/ai-content';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

const bodySchema = z.object({
  provider: z.enum(['claude', 'gemini', 'rules']).optional(),
});

/**
 * Generates SEO content (title, description, short, full) from the product's
 * existing fields. Returns the suggestion — does NOT save. The UI shows the
 * draft so the owner can edit before clicking "Save".
 */
export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params, user }) => {
  try {
    // Per-user (not per-IP) rate limit so a stuck button can't run up an
    // unbilled Claude/Gemini bill in a tight retry loop. 60/hour is well
    // above any human workflow (~1/minute) but trips well before billable
    // damage.
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

    const generated = await generateForProduct(
      {
        name: product.name,
        category: product.category?.name ?? null,
        brand: product.brand?.name ?? null,
        priceRetail: Number(product.priceRetail),
        shortDescription: product.content?.shortDescription ?? null,
      },
      { provider },
    );

    return successResponse(generated);
  } catch (error) {
    console.error('[AI generate]', error);
    return errorResponse('Не вдалося згенерувати опис', 500);
  }
});
