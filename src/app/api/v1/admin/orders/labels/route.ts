import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/utils/api-response';

export const POST = withRole('admin', 'manager')(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const { orderIds } = body;

      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return errorResponse('orderIds обов\'язковий (масив ID)', 400);
      }

      const orders = await prisma.order.findMany({
        where: { id: { in: orderIds.map(Number) } },
        include: {
          items: {
            include: { product: { select: { name: true, code: true } } },
          },
        },
      });

      // Generate simple text-based labels (HTML for printing)
      const labelsHtml = orders.map((o) => {
        return `
          <div style="page-break-after: always; border: 2px solid #000; padding: 20px; margin: 10px; font-family: Arial, sans-serif;">
            <h2 style="margin: 0 0 10px;">Замовлення #${o.orderNumber}</h2>
            <p><strong>Отримувач:</strong> ${o.contactName}</p>
            <p><strong>Телефон:</strong> ${o.contactPhone}</p>
            <p><strong>Місто:</strong> ${o.deliveryCity || '—'}</p>
            <p><strong>Адреса:</strong> ${o.deliveryAddress || '—'}</p>
            <p><strong>Доставка:</strong> ${o.deliveryMethod}</p>
            ${o.trackingNumber ? `<p><strong>ТТН:</strong> ${o.trackingNumber}</p>` : ''}
            <p><strong>Сума:</strong> ${Number(o.totalAmount).toFixed(2)} грн</p>
            <hr/>
            <p style="font-size: 12px;">${o.items.map((i) => `${i.product?.name} x${i.quantity}`).join(', ')}</p>
          </div>
        `;
      }).join('');

      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Етикетки</title></head><body>${labelsHtml}</body></html>`;

      return new NextResponse(fullHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="labels_${new Date().toISOString().slice(0, 10)}.html"`,
        },
      });
    } catch {
      return errorResponse('Помилка генерації етикеток', 500);
    }
  }
);
