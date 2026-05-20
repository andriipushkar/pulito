import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { verifyDomain, DomainError } from '@/services/domain';
import { resolveActiveTenantId } from '@/lib/admin-tenant';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const POST = withRole2fa('admin')(
  async (request: NextRequest, { user }) => {
    try {
      const { domain } = await request.json();

      if (!domain || typeof domain !== 'string') {
        return errorResponse('Домен обов\'язковий');
      }

      const resolved = await resolveActiveTenantId(request, user.id);
      if ('error' in resolved) return resolved.error;

      const verified = await verifyDomain(resolved.tenantId, domain);
      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'tenant_domain',
        entityId: resolved.tenantId,
        details: { domain, action: 'verify', result: verified },
      });
      return successResponse({ verified });
    } catch (error) {
      if (error instanceof DomainError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/domains/verify POST] failed', { error });
      return errorResponse('Помилка верифікації домену', 500);
    }
  }
);
