import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getBilling, checkUsageLimits, BillingError } from '@/services/billing';

export const GET = withRole('admin')(
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
      return errorResponse('Помилка завантаження біллінгу', 500);
    }
  }
);
