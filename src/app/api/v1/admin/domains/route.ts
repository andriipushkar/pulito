import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { initiateDomainVerification, DomainError } from '@/services/domain';
import { resolveActiveTenantId } from '@/lib/admin-tenant';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const GET = withRole2fa('admin')(
  async (request, { user }) => {
    try {
      const resolved = await resolveActiveTenantId(request, user.id);
      if ('error' in resolved) return resolved.error;

      const tenant = await prisma.tenant.findUnique({
        where: { id: resolved.tenantId },
        select: {
          domain: true,
          domainVerified: true,
          domainVerificationToken: true,
        },
      });
      if (!tenant) return errorResponse('Тенант не знайдено', 404);

      return successResponse({
        domain: tenant.domain,
        verified: tenant.domainVerified,
        verificationToken: tenant.domainVerificationToken,
        txtRecordName: tenant.domain ? `_clean-verify.${tenant.domain}` : null,
      });
    } catch (err) {
      logger.error('[admin/domains GET] failed', { error: err });
      return errorResponse('Помилка завантаження інформації про домен', 500);
    }
  }
);

export const POST = withRole2fa('admin')(
  async (request: NextRequest, { user }) => {
    try {
      const { domain } = await request.json();

      if (!domain || typeof domain !== 'string') {
        return errorResponse('Домен обов\'язковий');
      }

      // Strict hostname format — no protocol, no trailing dot, no path.
      // RFC 1034/1123 + path-traversal guard.
      const cleaned = domain.trim().toLowerCase();
      const hostnameRegex =
        /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
      if (!hostnameRegex.test(cleaned)) {
        return errorResponse(
          'Невалідний домен. Очікується формат example.com (без http:// чи слешів)',
          400,
        );
      }

      const resolved = await resolveActiveTenantId(request, user.id);
      if ('error' in resolved) return resolved.error;

      const result = await initiateDomainVerification(resolved.tenantId, domain);
      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'tenant_domain',
        entityId: resolved.tenantId,
        details: { domain: cleaned, action: 'initiate_verification' },
      });
      return successResponse(result);
    } catch (error) {
      if (error instanceof DomainError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/domains POST] failed', { error });
      return errorResponse('Помилка ініціалізації верифікації', 500);
    }
  }
);
