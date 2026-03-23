import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/middleware/auth';
import { getPersonalizedRecommendations } from '@/services/recommendation';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withOptionalAuth(
  async (request: NextRequest, { user }) => {
    try {
      const { searchParams } = new URL(request.url);
      const limit = Math.min(Number(searchParams.get('limit')) || 12, 50);

      // Authenticated user: personalized recommendations
      if (user) {
        const recommendations = await getPersonalizedRecommendations(user.id, limit);
        return successResponse(recommendations);
      }

      // Unauthenticated: popular/trending products
      const popular = await prisma.product.findMany({
        where: { isActive: true },
        orderBy: { ordersCount: 'desc' },
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          code: true,
          priceRetail: true,
          imagePath: true,
          isPromo: true,
          images: {
            select: { pathThumbnail: true },
            where: { isMain: true },
            take: 1,
          },
        },
      });

      return successResponse(popular);
    } catch {
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
