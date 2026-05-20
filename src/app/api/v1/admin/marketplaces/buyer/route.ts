import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { OrderSource } from '@/../generated/prisma';
import { MARKETPLACE_PLATFORMS } from '@/services/marketplace-health';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

const MARKETPLACE_SOURCES = [
  OrderSource.olx,
  OrderSource.rozetka,
  OrderSource.prom,
  OrderSource.epicentrk,
];

/**
 * Aggregate everything we know about a single marketplace buyer:
 *  - all marketplace orders matching by phone OR name
 *  - all messages from any thread where the buyer name matches
 *  - all returns linked to those orders
 *
 * Lookup keys (any of):
 *   ?phone=+380...           — preferred (highest precision)
 *   ?name=Іван Петренко      — fallback (case-insensitive substring)
 */
export const GET = withRole('admin', 'manager')(async (req: NextRequest) => {
  try {
    const phone = req.nextUrl.searchParams.get('phone')?.trim() || '';
    const name = req.nextUrl.searchParams.get('name')?.trim() || '';
    if (!phone && !name) {
      return errorResponse('Потрібен параметр phone або name', 400);
    }

    // Build OR-criteria depending on what was provided.
    const orderWhere: Record<string, unknown> = {
      source: { in: MARKETPLACE_SOURCES },
    };
    const ors: Record<string, unknown>[] = [];
    if (phone) ors.push({ contactPhone: { contains: phone } });
    if (name) ors.push({ contactName: { contains: name, mode: 'insensitive' } });
    if (ors.length > 0) orderWhere.OR = ors;

    const orders = await prisma.order.findMany({
      where: orderWhere,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        items: { select: { productName: true, quantity: true, priceAtOrder: true } },
        marketplaceReturns: {
          select: { id: true, status: true, reason: true, refundAmount: true, createdAt: true },
        },
      },
    });

    // Messages: marketplace_messages stores buyer_name as a free-form string.
    // Match by name (no phone in MarketplaceMessage) — best-effort.
    let messages: {
      id: number;
      platform: string;
      buyerName: string;
      text: string;
      receivedAt: Date;
      isRead: boolean;
      firstRespondedAt: Date | null;
    }[] = [];
    if (name) {
      messages = await prisma.marketplaceMessage.findMany({
        where: {
          platform: { in: MARKETPLACE_PLATFORMS as readonly string[] as string[] },
          buyerName: { contains: name, mode: 'insensitive' },
        },
        orderBy: { receivedAt: 'desc' },
        take: 200,
        select: {
          id: true,
          platform: true,
          buyerName: true,
          text: true,
          receivedAt: true,
          isRead: true,
          firstRespondedAt: true,
        },
      });
    }

    const totalSpent = orders.reduce(
      (s, o) => (o.status === 'cancelled' ? s : s + Number(o.totalAmount)),
      0,
    );
    const completedOrders = orders.filter((o) => o.status === 'completed').length;
    const cancelledOrders = orders.filter((o) => o.status === 'cancelled').length;
    const returnsCount = orders.reduce((s, o) => s + o.marketplaceReturns.length, 0);
    const unreadMessages = messages.filter((m) => !m.isRead).length;

    return successResponse({
      query: { phone, name },
      stats: {
        ordersCount: orders.length,
        completedOrders,
        cancelledOrders,
        totalSpent: Math.round(totalSpent * 100) / 100,
        returnsCount,
        unreadMessages,
        firstOrderAt: orders[orders.length - 1]?.createdAt ?? null,
        lastOrderAt: orders[0]?.createdAt ?? null,
      },
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        externalId: o.externalId,
        source: o.source,
        status: o.status,
        totalAmount: Number(o.totalAmount),
        contactName: o.contactName,
        contactPhone: o.contactPhone,
        createdAt: o.createdAt,
        trackingNumber: o.trackingNumber,
        itemsCount: o.items.reduce((s, i) => s + i.quantity, 0),
        items: o.items.map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
          priceAtOrder: Number(i.priceAtOrder),
        })),
        returns: o.marketplaceReturns.map((r) => ({
          id: r.id,
          status: r.status,
          reason: r.reason,
          refundAmount: r.refundAmount,
          createdAt: r.createdAt,
        })),
      })),
      messages: messages.map((m) => ({
        id: String(m.id),
        platform: m.platform,
        buyerName: m.buyerName,
        text: m.text,
        receivedAt: m.receivedAt,
        isRead: m.isRead,
        firstRespondedAt: m.firstRespondedAt,
      })),
    });
  } catch (err) {
    logger.error('[admin/marketplaces/buyer] GET failed', { error: err });
    return errorResponse('Помилка завантаження', 500);
  }
});
