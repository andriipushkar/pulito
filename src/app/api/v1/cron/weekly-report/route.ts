import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Gather weekly stats
    const [ordersCount, revenue, newUsers, topProducts] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: weekAgo }, status: { notIn: ['cancelled', 'returned'] } },
        _sum: { totalAmount: true },
      }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { createdAt: { gte: weekAgo } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    // Get product names for top products
    const productIds = topProducts.map((p) => p.productId).filter(Boolean) as number[];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p.name]));

    const totalRevenue = Number(revenue._sum.totalAmount || 0);
    const topList = topProducts
      .map((p, i) => `${i + 1}. ${productMap.get(p.productId!) || 'Невідомий'} — ${p._sum.quantity} шт.`)
      .join('\n');

    // Format message
    const message = [
      '📊 <b>Щотижневий звіт — Порошок</b>',
      '',
      `📦 Замовлень: <b>${ordersCount}</b>`,
      `💰 Виручка: <b>${totalRevenue.toFixed(0)} ₴</b>`,
      `👥 Нових клієнтів: <b>${newUsers}</b>`,
      '',
      '🏆 <b>Топ-5 товарів:</b>',
      topList || 'Немає даних',
      '',
      `📅 Період: ${weekAgo.toLocaleDateString('uk-UA')} — ${new Date().toLocaleDateString('uk-UA')}`,
    ].join('\n');

    // Send to Telegram manager chat
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_MANAGER_CHAT_ID;

    if (botToken && chatId) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });
    }

    return successResponse({ sent: !!(botToken && chatId), message });
  } catch {
    return errorResponse('Помилка генерації звіту', 500);
  }
}
