import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { refundPayment, PaymentError } from '@/services/payment';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

// In-process rate limit: at most 10 refund operations per admin per minute.
// A compromised session shouldn't be able to drain the merchant account.
const REFUND_RATE_BUCKET = new Map<number, number[]>();
const REFUND_RATE_WINDOW_MS = 60_000;
const REFUND_RATE_MAX = 10;
function refundRateLimited(adminId: number): boolean {
  const now = Date.now();
  const hits = (REFUND_RATE_BUCKET.get(adminId) ?? []).filter(
    (t) => now - t < REFUND_RATE_WINDOW_MS,
  );
  hits.push(now);
  REFUND_RATE_BUCKET.set(adminId, hits);
  return hits.length > REFUND_RATE_MAX;
}

// Managers can also process refunds — they handle day-to-day customer
// service. Keeping it admin-only stalls disputes on weekends. 2FA is
// required since this is a money-moving operation: a stolen session
// cookie alone shouldn't be enough to drain the merchant account.
export const POST = withRole2fa('admin', 'manager')(async (request: NextRequest, { params, user }) => {
  try {
    if (refundRateLimited(user.id)) {
      return errorResponse('Забагато запитів на повернення. Зачекайте хвилину.', 429);
    }
    const { id } = await params!;
    const orderId = Number(id);
    if (!orderId) return errorResponse('Невірний ID замовлення', 400);

    const body = await request.json().catch(() => ({}));
    const amount = body.amount ? Number(body.amount) : undefined;

    if (amount !== undefined && (isNaN(amount) || amount <= 0)) {
      return errorResponse('Невірна сума повернення', 400);
    }

    const result = await refundPayment(orderId, amount);

    if (!result.success) {
      return errorResponse(result.message || 'Не вдалося виконати повернення', 400);
    }

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'order_refund',
      entityId: orderId,
      details: { amount: amount ?? 'full', success: true },
    });

    return successResponse(result);
  } catch (error) {
    if (error instanceof PaymentError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/orders/[id]/refund] POST failed', { error });
    return errorResponse('Помилка сервера', 500);
  }
});
