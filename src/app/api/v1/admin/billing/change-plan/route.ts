import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { changePlan, BillingError } from '@/services/billing';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const POST = withRole2fa('admin')(
  async (request: NextRequest, { user }) => {
    try {
      const { planId } = await request.json();

      if (!planId || typeof planId !== 'number') {
        return errorResponse('planId обов\'язковий');
      }

      const membership = await prisma.tenantUser.findFirst({
        where: { userId: user.id },
      });

      if (!membership) {
        return errorResponse('Тенант не знайдено', 404);
      }

      const billing = await changePlan(membership.tenantId, planId);
      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'tenant_billing',
        entityId: membership.tenantId,
        details: { newPlanId: planId },
      });
      return successResponse(billing);
    } catch (error) {
      if (error instanceof BillingError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/billing/change-plan] POST failed', { error });
      return errorResponse('Помилка зміни плану', 500);
    }
  }
);
