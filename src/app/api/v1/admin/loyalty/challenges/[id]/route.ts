import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// Partial update: the admin page sends either the full edit form or just
// { isActive } (the active/inactive toggle). Field names match the
// LoyaltyChallenge model (name/target/reward), not title/goal/rewardPoints.
const updateChallengeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(1000).optional(),
  type: z.enum(['order_count', 'order_amount', 'review', 'referral', 'streak']).optional(),
  target: z.number().int().positive().optional(),
  reward: z.number().int().positive().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const PATCH = withRole('admin')(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = parseId(id);
    if (numId === null) return errorResponse('Невалідний ID', 400);

    const body = await request.json();
    const parsed = updateChallengeSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const d = parsed.data;

    const data: Record<string, unknown> = {};
    if (d.name !== undefined) data.name = d.name;
    if (d.description !== undefined) data.description = d.description;
    if (d.type !== undefined) data.type = d.type;
    if (d.target !== undefined) data.target = d.target;
    if (d.reward !== undefined) data.reward = d.reward;
    if (d.startDate !== undefined) data.startDate = d.startDate ? new Date(d.startDate) : null;
    if (d.endDate !== undefined) data.endDate = d.endDate ? new Date(d.endDate) : null;
    if (d.isActive !== undefined) data.isActive = d.isActive;

    if (Object.keys(data).length === 0) {
      return errorResponse('Немає полів для оновлення', 400);
    }

    try {
      const updated = await prisma.loyaltyChallenge.update({ where: { id: numId }, data });
      return successResponse(updated);
    } catch {
      return errorResponse('Челендж не знайдено', 404);
    }
  } catch (err) {
    logger.error('[admin/loyalty/challenges/[id]] PATCH failed', { error: err });
    return errorResponse('Помилка оновлення челенджу', 500);
  }
});

export const DELETE = withRole('admin')(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = parseId(id);
    if (numId === null) return errorResponse('Невалідний ID', 400);

    try {
      // Progress rows cascade-delete (onDelete: Cascade), but delete them
      // explicitly in a transaction so the operation is atomic & predictable.
      await prisma.$transaction([
        prisma.loyaltyChallengeProgress.deleteMany({ where: { challengeId: numId } }),
        prisma.loyaltyChallenge.delete({ where: { id: numId } }),
      ]);
    } catch {
      return errorResponse('Челендж не знайдено', 404);
    }
    return successResponse({ deleted: true });
  } catch (err) {
    logger.error('[admin/loyalty/challenges/[id]] DELETE failed', { error: err });
    return errorResponse('Помилка видалення челенджу', 500);
  }
});
