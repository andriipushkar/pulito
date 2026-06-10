import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { generateSocialPost } from '@/services/ai-content';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { env } from '@/config/env';

const schema = z
  .object({
    productId: z.number().int().positive().optional().nullable(),
    topic: z.string().min(3).max(200).optional().nullable(),
    channels: z.array(z.string().max(30)).max(10).optional(),
    provider: z.enum(['claude', 'gemini', 'rules']).optional(),
  })
  .refine((d) => d.productId || d.topic, {
    message: 'Вкажіть товар або тему поста',
  });

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    // Same per-user AI quota as products/categories/blog AI endpoints.
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

    const product = parsed.data.productId
      ? await prisma.product.findUnique({
          where: { id: parsed.data.productId },
          select: {
            name: true,
            slug: true,
            priceRetail: true,
            priceRetailOld: true,
            brand: { select: { name: true } },
            category: { select: { name: true } },
            content: { select: { shortDescription: true } },
          },
        })
      : null;
    if (parsed.data.productId && !product) {
      return errorResponse('Товар не знайдено', 404);
    }

    const baseUrl = env.APP_URL.replace(/\/$/, '');
    const result = await generateSocialPost(
      {
        productName: product?.name ?? '',
        topic: parsed.data.topic ?? null,
        brand: product?.brand?.name ?? null,
        category: product?.category?.name ?? null,
        price: product ? Number(product.priceRetail) : null,
        oldPrice: product?.priceRetailOld ? Number(product.priceRetailOld) : null,
        productUrl: product ? `${baseUrl}/product/${product.slug}` : null,
        shortDescription: product?.content?.shortDescription ?? null,
        channels: parsed.data.channels,
      },
      { provider: parsed.data.provider },
    );

    return successResponse(result);
  } catch (err) {
    logger.error('[admin/publications/ai-generate] failed', { error: err });
    return errorResponse('Не вдалося згенерувати пост', 500);
  }
});
