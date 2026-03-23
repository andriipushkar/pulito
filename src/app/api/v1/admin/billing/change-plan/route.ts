import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { changePlan, BillingError } from '@/services/billing';

export const POST = withRole('admin')(
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
      return successResponse(billing);
    } catch (error) {
      if (error instanceof BillingError) {
        return errorResponse(error.message, error.statusCode);
      }
      return errorResponse('Помилка зміни плану', 500);
    }
  }
);
