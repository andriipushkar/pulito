import type { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantFromRequest } from '@/lib/tenant';
import { errorResponse } from '@/utils/api-response';

/**
 * Resolve the tenant an admin is currently operating on. Resolution order:
 *   1. Active tenant from request host (subdomain / custom domain) — verifies
 *      the admin is a member of that tenant.
 *   2. Single-tenant fallback — if the admin has exactly one membership, use it.
 *
 * Refuses ("ambiguous") when the admin has multiple memberships and the
 * request doesn't pin a specific tenant. Picking "the first one" silently
 * lets an admin mutate the wrong tenant's data.
 */
export async function resolveActiveTenantId(
  request: NextRequest,
  userId: number,
): Promise<{ tenantId: number } | { error: NextResponse }> {
  const tenant = await getTenantFromRequest(request);
  if (tenant) {
    const membership = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId } },
    });
    if (!membership) {
      return { error: errorResponse('Немає доступу до цього тенанта', 403) };
    }
    return { tenantId: tenant.id };
  }

  const memberships = await prisma.tenantUser.findMany({
    where: { userId },
    select: { tenantId: true },
    take: 2,
  });
  if (memberships.length === 0) {
    return { error: errorResponse('Тенант не знайдено', 404) };
  }
  if (memberships.length > 1) {
    return { error: errorResponse('Не вдалось визначити активний тенант', 400) };
  }
  return { tenantId: memberships[0].tenantId };
}
