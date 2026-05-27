import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    // Same shape as /me/gdpr-export — full personal-data dump. Reuse the
    // `sensitive` bucket so abuse can't double as a privacy-exfil cron.
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.sensitive);
    if (!rl.allowed) {
      return errorResponse(
        `Забагато експортів. Спробуйте через ${Math.ceil(rl.retryAfter / 60)} хв.`,
        429,
      );
    }
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        companyName: true,
        edrpou: true,
        role: true,
        wholesaleStatus: true,
        createdAt: true,
        addresses: {
          select: {
            label: true,
            city: true,
            street: true,
            building: true,
            apartment: true,
            postalCode: true,
            isDefault: true,
          },
        },
        orders: {
          select: {
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
            items: {
              select: {
                productName: true,
                quantity: true,
                priceAtOrder: true,
                subtotal: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        wishlists: {
          select: {
            name: true,
            items: {
              select: {
                product: { select: { name: true, code: true } },
              },
            },
          },
        },
      },
    });

    if (!userData) {
      return errorResponse('Користувача не знайдено', 404);
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      personalData: {
        email: userData.email,
        fullName: userData.fullName,
        phone: userData.phone,
        companyName: userData.companyName,
        edrpou: userData.edrpou,
        role: userData.role,
        wholesaleStatus: userData.wholesaleStatus,
        registeredAt: userData.createdAt,
      },
      addresses: userData.addresses,
      orders: userData.orders.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
        totalAmount: Number(o.totalAmount),
        createdAt: o.createdAt,
        items: o.items.map((i) => ({
          product: i.productName,
          quantity: i.quantity,
          price: Number(i.priceAtOrder),
          subtotal: Number(i.subtotal),
        })),
      })),
      wishlists: userData.wishlists.map((w) => ({
        name: w.name,
        products: w.items.map((i) => ({
          name: i.product?.name || '',
          code: i.product?.code || '',
        })),
      })),
    };

    // GDPR Article 20 — every export must be auditable.
    await logAudit({
      userId: user.id,
      actionType: 'gdpr_export',
      entityType: 'user',
      entityId: user.id,
      details: { source: 'me/export' },
      ipAddress: getClientIp(request),
    });

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="my-data-${new Date().toISOString().slice(0, 10)}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
