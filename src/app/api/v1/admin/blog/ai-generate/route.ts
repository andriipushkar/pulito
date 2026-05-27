import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { generateForBlog } from '@/services/ai-content';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

const schema = z.object({
  topic: z.string().min(3).max(200),
  categoryId: z.number().int().positive().optional().nullable(),
  tone: z.string().max(60).optional(),
  existingTags: z.array(z.string()).optional(),
  provider: z.enum(['claude', 'gemini', 'rules']).optional(),
});

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    // Shares the per-user AI quota with /products and /categories AI
    // endpoints — stops a stuck button (or stolen session) from running up
    // an unbilled Claude/Gemini bill across blog/products/categories.
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

    const category = parsed.data.categoryId
      ? await prisma.blogCategory.findUnique({
          where: { id: parsed.data.categoryId },
          select: { name: true },
        })
      : null;

    const result = await generateForBlog(
      {
        topic: parsed.data.topic,
        categoryName: category?.name ?? null,
        tone: parsed.data.tone,
        existingTags: parsed.data.existingTags,
      },
      { provider: parsed.data.provider },
    );

    return successResponse(result);
  } catch (err) {
    logger.error('[admin/blog/ai-generate] failed', { error: err });
    return errorResponse('Не вдалося згенерувати статтю', 500);
  }
});
