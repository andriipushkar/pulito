import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { removeDomain } from '@/services/domain';
import { resolveActiveTenantId } from '@/lib/admin-tenant';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { prisma } from '@/lib/prisma';

export const DELETE = withRole2fa('admin')(async (request: NextRequest, { user }) => {
  try {
    const resolved = await resolveActiveTenantId(request, user.id);
    if ('error' in resolved) return resolved.error;

    // Snapshot the domain BEFORE removal so audit shows which custom
    // hostname was unmapped (auth flow falls back to default — important
    // forensic context if a customer reports "the site changed branding").
    const before = await prisma.tenant.findUnique({
      where: { id: resolved.tenantId },
      select: { domain: true, domainVerified: true },
    });

    await removeDomain(resolved.tenantId);

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'tenant_domain',
      entityId: resolved.tenantId,
      details: {
        action: 'remove',
        domain: before?.domain ?? null,
        wasVerified: before?.domainVerified ?? null,
      },
      ipAddress: getClientIp(request),
    });

    return successResponse({ removed: true });
  } catch (err) {
    logger.error('[admin/domains DELETE] failed', { error: err });
    return errorResponse('Помилка видалення домену', 500);
  }
});
