import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { removeDomain } from '@/services/domain';

export const DELETE = withRole('admin')(
  async (
    _request: NextRequest,
    { user }
  ) => {
    try {
      const membership = await prisma.tenantUser.findFirst({
        where: { userId: user.id },
      });

      if (!membership) {
        return errorResponse('Тенант не знайдено', 404);
      }

      await removeDomain(membership.tenantId);
      return successResponse({ removed: true });
    } catch {
      return errorResponse('Помилка видалення домену', 500);
    }
  }
);
