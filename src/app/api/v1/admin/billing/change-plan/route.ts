import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { changePlan, BillingError } from '@/services/billing';
import { resolveActiveTenantId } from '@/lib/admin-tenant';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

// Namespace for the per-tenant plan-change advisory lock. Postgres uses
// (int4, int4) pairs — pick any constant for the namespace; tenantId fills
// the second slot so two tenants never contend with each other.
const PLAN_CHANGE_LOCK_NS = 0x504c414e; // "PLAN"

export const POST = withRole2fa('admin')(async (request: NextRequest, { user }) => {
  try {
    const { planId } = await request.json();

    if (!planId || typeof planId !== 'number') {
      return errorResponse("planId обов'язковий");
    }

    const resolved = await resolveActiveTenantId(request, user.id);
    if ('error' in resolved) return resolved.error;
    const tenantId = resolved.tenantId;

    // Serialise concurrent plan-change requests for the same tenant.
    // Without this, two rapid "Upgrade" clicks both pass changePlan()'s
    // initial read, both create invoices, double-billing the customer.
    // Advisory lock is auto-released when the request's DB connection
    // returns to the pool (or via explicit unlock below).
    const lockRows = await prisma.$queryRaw<{ ok: boolean }[]>`
        SELECT pg_try_advisory_lock(${PLAN_CHANGE_LOCK_NS}::int, ${tenantId}::int) AS ok
      `;
    if (!lockRows[0]?.ok) {
      return errorResponse('Зміна плану вже виконується для цього тенанта', 409);
    }
    const releaseLock = async () => {
      try {
        await prisma.$queryRaw`SELECT pg_advisory_unlock(${PLAN_CHANGE_LOCK_NS}::int, ${tenantId}::int)`;
      } catch {
        // ignored — connection may have already returned to pool
      }
    };

    try {
      // Read OLD plan BEFORE changing so audit shows a real diff (audit
      // reviewers need both sides; previously only newPlanId was logged).
      const beforeBilling = await prisma.tenantBilling.findUnique({
        where: { tenantId },
        select: { planId: true, plan: { select: { name: true } } },
      });
      const oldPlanId = beforeBilling?.planId ?? null;

      const billing = await changePlan(tenantId, planId);
      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'tenant_billing',
        entityId: tenantId,
        details: {
          oldPlanId,
          newPlanId: planId,
          oldPlanName: beforeBilling?.plan?.name ?? null,
        },
      });
      return successResponse(billing);
    } finally {
      await releaseLock();
    }
  } catch (error) {
    if (error instanceof BillingError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/billing/change-plan] POST failed', { error });
    return errorResponse('Помилка зміни плану', 500);
  }
});
