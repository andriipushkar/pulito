import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { initiateDomainVerification, DomainError } from '@/services/domain';

export const GET = withRole('admin')(
  async (_request, { user }) => {
    try {
      // For now, resolve tenantId from user's first tenant membership
      const membership = await prisma.tenantUser.findFirst({
        where: { userId: user.id },
        include: {
          tenant: {
            select: {
              id: true,
              domain: true,
              domainVerified: true,
              domainVerificationToken: true,
            },
          },
        },
      });

      if (!membership) {
        return errorResponse('Тенант не знайдено', 404);
      }

      const { tenant } = membership;
      return successResponse({
        domain: tenant.domain,
        verified: tenant.domainVerified,
        verificationToken: tenant.domainVerificationToken,
        txtRecordName: tenant.domain ? `_clean-verify.${tenant.domain}` : null,
      });
    } catch {
      return errorResponse('Помилка завантаження інформації про домен', 500);
    }
  }
);

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

      const result = await initiateDomainVerification(membership.tenantId, domain);
      return successResponse(result);
    } catch (error) {
      if (error instanceof DomainError) {
        return errorResponse(error.message, error.statusCode);
      }
      return errorResponse('Помилка ініціалізації верифікації', 500);
    }
  }
);
