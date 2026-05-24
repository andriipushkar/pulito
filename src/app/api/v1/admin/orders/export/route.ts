import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    // Throttle per admin: an order export joins items + product names for
    // up to 5000 orders, so a runaway loop can saturate the DB.
    const rl = await checkRateLimit(`u${user.id}`, RATE_LIMITS.adminExport);
    if (!rl.allowed) {
      return errorResponse(`Забагато експортів. Спробуйте через ${rl.retryAfter}с`, 429);
    }
    const body = await request.json();
    const { orderIds, format = 'csv' } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return errorResponse("orderIds обов'язковий (масив ID)", 400);
    }
    // Cap batch size — without this a single POST could DoS the DB by
    // asking for millions of rows + a full items-join.
    if (orderIds.length > 5000) {
      return errorResponse('Максимум 5000 замовлень за один експорт', 400);
    }
    // Reject non-numeric IDs early so Prisma doesn't choke on NaN.
    const ids = orderIds.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length === 0) {
      return errorResponse('Жоден ID не пройшов валідацію', 400);
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: ids } },
      include: {
        items: { include: { product: { select: { name: true, code: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build CSV
    const rows = [
      ['Номер', 'Дата', 'Клієнт', 'Телефон', 'Статус', 'Сума', 'Доставка', 'Товари'].join(';'),
    ];
    for (const o of orders) {
      const items = o.items.map((i) => `${i.product?.name || ''} x${i.quantity}`).join(', ');
      rows.push(
        [
          o.orderNumber,
          new Date(o.createdAt).toLocaleDateString('uk-UA'),
          o.contactName,
          o.contactPhone,
          o.status,
          Number(o.totalAmount).toFixed(2),
          o.deliveryMethod,
          items,
        ].join(';'),
      );
    }

    const csv = '\uFEFF' + rows.join('\n');
    const filename = `orders_${new Date().toISOString().slice(0, 10)}.${format}`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    logger.error('[admin/orders/export] POST failed', { error: err });
    return errorResponse('Помилка експорту замовлень', 500);
  }
});
