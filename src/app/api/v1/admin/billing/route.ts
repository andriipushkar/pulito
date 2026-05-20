import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getBilling, checkUsageLimits, BillingError } from '@/services/billing';
import { logger } from '@/lib/logger';

export const GET = withRole2fa('admin')(
  async (_request, { user }) => {
    try {
      const membership = await prisma.tenantUser.findFirst({
        where: { userId: user.id },
      });

      if (!membership) {
        return errorResponse('Тенант не знайдено', 404);
      }

      const billing = await getBilling(membership.tenantId);
      const usage = await checkUsageLimits(membership.tenantId);

      return successResponse({ billing, usage });
    } catch (error) {
      if (error instanceof BillingError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/billing] GET failed', { error });
      return errorResponse('Помилка завантаження біллінгу', 500);
    }
  }
);
