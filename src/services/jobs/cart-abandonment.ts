import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { sendCartAbandonmentEmail } from '../email-template';

export async function processAbandonedCarts(hoursThreshold = 24) {
  const thresholdDate = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);

  // Single query with joins — avoids N+1 problem
  const users = await prisma.user.findMany({
    where: {
      cartItems: {
        some: { updatedAt: { lt: thresholdDate } },
      },
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      cartItems: {
        where: { updatedAt: { lt: thresholdDate } },
        include: {
          product: { select: { name: true, priceRetail: true } },
        },
      },
    },
  });

  if (users.length === 0) {
    return { sent: 0, message: 'Немає покинутих кошиків' };
  }

  let sent = 0;

  for (const user of users) {
    try {
      if (!user.email || user.cartItems.length === 0) continue;

      await sendCartAbandonmentEmail({
        to: user.email,
        name: user.fullName,
        items: user.cartItems.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: Number(item.product.priceRetail),
        })),
        cartUrl: `${env.APP_URL}/cart`,
      });
      sent++;
    } catch {
      // Continue processing other users
    }
  }

  return { sent, total: users.length };
}
