import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { z } from 'zod';

const createChallengeSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  type: z.enum(['order_count', 'order_amount', 'review', 'referral', 'streak']),
  target: z.number().int().positive(),
  reward: z.number().int().positive(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const GET = withRole('admin', 'manager')(async () => {
  try {
    const challenges = await prisma.loyaltyChallenge.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { progress: true } },
      },
    });

    const result = challenges.map((c) => ({
      ...c,
      participantsCount: c._count.progress,
      _count: undefined,
    }));

    return successResponse(result);
  } catch {
    return errorResponse('Помилка завантаження челенджів', 500);
  }
});

export const POST = withRole('admin')(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = createChallengeSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse('Невірні дані', 400);
    }

    const challenge = await prisma.loyaltyChallenge.create({
      data: {
        ...parsed.data,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      },
    });

    return successResponse(challenge, 201);
  } catch {
    return errorResponse('Помилка створення челенджу', 500);
  }
});
