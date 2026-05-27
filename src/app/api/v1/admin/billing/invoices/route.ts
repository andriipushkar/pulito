import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { resolveActiveTenantId } from '@/lib/admin-tenant';
import { logger } from '@/lib/logger';

// Hard cap so a tenant with years of monthly invoices doesn't blow past the
// payload budget. Pagination via ?page= for older history. 50 covers the
// last ~4 years of monthly billing — typically all the user wants to see
// in the UI.
const PAGE_SIZE = 50;
const MAX_PAGE = 100;

export const GET = withRole2fa('admin')(async (request, { user }) => {
  try {
    const resolved = await resolveActiveTenantId(request, user.id);
    if ('error' in resolved) return resolved.error;

    const billing = await prisma.tenantBilling.findUnique({
      where: { tenantId: resolved.tenantId },
    });

    if (!billing) {
      return errorResponse('Біллінг не знайдено', 404);
    }

    // Defense-in-depth: the billing row was looked up by resolved tenantId,
    // so we shouldn't be able to see another tenant's billing — but assert
    // it explicitly. A future code refactor that, say, indexes by URL param
    // instead of resolved.tenantId can't silently leak invoices.
    if (billing.tenantId !== resolved.tenantId) {
      logger.error('[admin/billing/invoices] tenant boundary violation', {
        requestedTenantId: resolved.tenantId,
        billingTenantId: billing.tenantId,
      });
      return errorResponse('Доступ заборонено', 403);
    }

    const url = request.nextUrl;
    const page = Math.min(MAX_PAGE, Math.max(1, Number(url.searchParams.get('page')) || 1));
    const [invoices, total] = await Promise.all([
      prisma.billingInvoice.findMany({
        where: { billingId: billing.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.billingInvoice.count({ where: { billingId: billing.id } }),
    ]);

    return successResponse({ invoices, total, page, pageSize: PAGE_SIZE });
  } catch (err) {
    logger.error('[admin/billing/invoices] GET failed', { error: err });
    return errorResponse('Помилка завантаження рахунків', 500);
  }
});
