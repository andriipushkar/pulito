import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { verifyDomain, DomainError } from '@/services/domain';

export const POST = withRole('admin')(
  async (request: NextRequest, { user }) => {
    try {
      const { domain } = await request.json();

      if (!domain || typeof domain !== 'string') {
        return errorResponse('Домен обов\'язковий');
      }

      const membership = await prisma.tenantUser.findFirst({
        where: { userId: user.id },
      });

      if (!membership) {
        return errorResponse('Тенант не знайдено', 404);
      }

      const verified = await verifyDomain(membership.tenantId, domain);
      return successResponse({ verified });
    } catch (error) {
      if (error instanceof DomainError) {
        return errorResponse(error.message, error.statusCode);
      }
      return errorResponse('Помилка верифікації домену', 500);
    }
  }
);
