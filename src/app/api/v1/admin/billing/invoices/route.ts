import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
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

      const billing = await prisma.tenantBilling.findUnique({
        where: { tenantId: membership.tenantId },
      });

      if (!billing) {
        return errorResponse('Біллінг не знайдено', 404);
      }

      const invoices = await prisma.billingInvoice.findMany({
        where: { billingId: billing.id },
        orderBy: { createdAt: 'desc' },
      });

      return successResponse(invoices);
    } catch (err) {
      logger.error('[admin/billing/invoices] GET failed', { error: err });
      return errorResponse('Помилка завантаження рахунків', 500);
    }
  }
);
