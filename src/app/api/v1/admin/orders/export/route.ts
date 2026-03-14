import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/utils/api-response';

export const POST = withRole('admin', 'manager')(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const { orderIds, format = 'csv' } = body;

      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return errorResponse('orderIds обов\'язковий (масив ID)', 400);
      }

      const orders = await prisma.order.findMany({
        where: { id: { in: orderIds.map(Number) } },
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
        rows.push([
          o.orderNumber,
          new Date(o.createdAt).toLocaleDateString('uk-UA'),
          o.contactName,
          o.contactPhone,
          o.status,
          Number(o.totalAmount).toFixed(2),
          o.deliveryMethod,
          items,
        ].join(';'));
      }

      const csv = '\uFEFF' + rows.join('\n');
      const filename = `orders_${new Date().toISOString().slice(0, 10)}.${format}`;

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } catch {
      return errorResponse('Помилка експорту замовлень', 500);
    }
  }
);
