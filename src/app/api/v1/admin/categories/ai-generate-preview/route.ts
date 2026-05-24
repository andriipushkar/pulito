import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { generateForCategory } from '@/services/ai-content';

const schema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.number().int().positive().optional().nullable(),
  provider: z.enum(['claude', 'gemini', 'rules']).optional(),
});

/**
 * Generate category SEO content from in-progress form data — used on the
 * admin "create category" form, before a row exists in DB.
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

    const parent = parsed.data.parentId
      ? await prisma.category.findUnique({
          where: { id: parsed.data.parentId },
          select: { name: true },
        })
      : null;

    const generated = await generateForCategory(
      {
        name: parsed.data.name,
        parentName: parent?.name ?? null,
        productCount: 0,
      },
      { provider: parsed.data.provider },
    );

    return successResponse(generated);
  } catch (error) {
    console.error('[AI category generate-preview]', error);
    return errorResponse('Не вдалося згенерувати опис категорії', 500);
  }
});
