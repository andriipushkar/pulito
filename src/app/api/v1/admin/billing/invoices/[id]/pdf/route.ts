import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { resolveActiveTenantId } from '@/lib/admin-tenant';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

/**
 * Returns the invoice PDF (or a redirect to its URL) ONLY if the requesting
 * user's tenant owns the invoice. Previously `pdfUrl` was rendered directly
 * in the admin UI, so anyone who guessed an invoice ID could fetch another
 * tenant's PDF by visiting `pdfUrl` straight (no auth on `/uploads/...`).
 *
 * Going through this endpoint forces:
 *   - withRole2fa('admin') — operator must be authenticated with 2FA
 *   - tenant ownership check — invoice.billing.tenantId === user's tenant
 *   - audit-log — who downloaded which invoice and when
 */
export const GET = withRole2fa('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) {
      return errorResponse('Невалідний ID рахунку', 400);
    }

    const resolved = await resolveActiveTenantId(request, user.id);
    if ('error' in resolved) return resolved.error;

    const invoice = await prisma.billingInvoice.findUnique({
      where: { id: numId },
      include: { billing: { select: { tenantId: true } } },
    });

    if (!invoice) {
      return errorResponse('Рахунок не знайдено', 404);
    }
    if (invoice.billing.tenantId !== resolved.tenantId) {
      // Don't leak "this invoice exists, you just can't see it" — 404 is
      // indistinguishable from "no such invoice".
      return errorResponse('Рахунок не знайдено', 404);
    }
    if (!invoice.pdfUrl) {
      return errorResponse('PDF цього рахунку ще не згенеровано', 404);
    }

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'billing_invoice_pdf_view',
      entityId: numId,
      details: { tenantId: resolved.tenantId, action: 'pdf_view' },
      ipAddress: getClientIp(request),
    }).catch((err) => {
      logger.warn('[billing/invoice/pdf] audit log failed (non-fatal)', {
        error: String(err),
      });
    });

    // Return the URL — frontend follows it. If pdfUrl is a local path
    // like `/uploads/invoices/...`, downstream nginx will serve it.
    // (If we later move PDFs behind auth, this is the single chokepoint
    // we change.)
    return successResponse({ pdfUrl: invoice.pdfUrl });
  } catch (err) {
    logger.error('[admin/billing/invoices/[id]/pdf] GET failed', { error: err });
    return errorResponse('Помилка завантаження PDF', 500);
  }
});
