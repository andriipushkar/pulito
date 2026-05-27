import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { recordCount, StockCountError } from '@/services/stock-count';
import { prisma } from '@/lib/prisma';
import { scanSchema } from '@/validators/stock-count';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

/**
 * Resolve a scanned code to a productId and record the counted quantity.
 * Lookup priority:
 *   1. barcode (EAN/UPC, 8-14 digits — what the physical scanner reads)
 *   2. internal productCode
 *   3. numeric productId fallback
 */
export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const countId = Number(id);
    if (!Number.isInteger(countId) || countId <= 0) {
      return errorResponse('Невалідний ID інвентаризації', 400);
    }

    // Throttle per (admin, count) so a stuck wedge scanner can't drown a
    // single inventory in phantom scans. Real human pace is well under
    // the cap.
    const rl = await checkRateLimit(`user:${user!.id}:count:${countId}`, RATE_LIMITS.adminScan);
    if (!rl.allowed) {
      return errorResponse(
        `Сканер працює занадто швидко. Спробуйте через ${Math.ceil(rl.retryAfter)} с.`,
        429,
      );
    }

    const body = await request.json();
    const parsed = scanSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const rawCode = parsed.data.code.trim();
    const qty = parsed.data.quantity;
    const mode = parsed.data.mode;

    if (!rawCode) return errorResponse('Введіть код товару', 400);

    let productId: number | null = null;

    // 1. Try barcode (EAN/UPC) first — that's what the physical scanner reads.
    const digits = rawCode.replace(/\D/g, '');
    if (/^\d{8,14}$/.test(digits)) {
      // Skip soft-deleted products — scanning a removed product into an open
      // count creates a phantom row that closes inventory with a wrong delta.
      const byBarcode = await prisma.product.findUnique({
        where: { barcode: digits },
        select: { id: true, deletedAt: true },
      });
      if (byBarcode && !byBarcode.deletedAt) productId = byBarcode.id;
    }

    // 2. Internal productCode (case-sensitive — codes are case-significant SKUs).
    if (productId === null) {
      const byCode = await prisma.product.findUnique({
        where: { code: rawCode },
        select: { id: true, deletedAt: true },
      });
      if (byCode && !byCode.deletedAt) productId = byCode.id;
    }

    // 3. Numeric productId — only after barcode failed, to avoid catching
    //    short barcodes that happen to match an existing product ID.
    if (productId === null && /^\d+$/.test(rawCode)) {
      const byId = await prisma.product.findUnique({
        where: { id: Number(rawCode) },
        select: { id: true, deletedAt: true },
      });
      if (byId && !byId.deletedAt) productId = byId.id;
    }

    if (productId === null) {
      return errorResponse(`Товар з кодом "${rawCode}" не знайдено`, 404);
    }

    // Default mode = 'add' so repeated barcode scans accumulate the count
    // instead of overwriting. UI override sends mode='set' for the manual
    // correction field.
    const item = await recordCount(countId, productId, qty, mode);
    return successResponse(item);
  } catch (error) {
    if (error instanceof StockCountError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/stock-counts/[id]/scan] POST failed', { error });
    return errorResponse('Помилка сервера', 500);
  }
});
