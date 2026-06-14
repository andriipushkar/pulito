import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { privateResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { getSupplierReconciliation } from '@/services/suppliers/reconciliation';
import { todayKyivIso, kyivDateIso, daysAgoKyiv } from '@/utils/format';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Per-supplier money report (units, revenue, cost we owe, margin) over a
 * Kyiv-local date range. Defaults to the last 30 days. no-store — it's financial.
 */
export const GET = withRole(
  'manager',
  'admin',
)(async (request: NextRequest) => {
  try {
    const sp = request.nextUrl.searchParams;
    const from = sp.get('from') || kyivDateIso(daysAgoKyiv(30));
    const to = sp.get('to') || todayKyivIso();
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return errorResponse('Дати мають бути у форматі YYYY-MM-DD', 400);
    }
    if (from > to) return errorResponse('Початкова дата пізніша за кінцеву', 400);

    const supplierIdRaw = sp.get('supplierId');
    let supplierId: number | undefined;
    if (supplierIdRaw) {
      supplierId = Number(supplierIdRaw);
      if (isNaN(supplierId)) return errorResponse('Невалідний supplierId', 400);
    }

    const report = await getSupplierReconciliation({ from, to, supplierId });
    return privateResponse(report);
  } catch (err) {
    logger.error('[admin/supplier-channels/reconciliation] failed', { error: err });
    return errorResponse('Не вдалося сформувати звіт', 500);
  }
});
