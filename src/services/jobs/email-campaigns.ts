import { prisma } from '@/lib/prisma';
import { sendWelcomeEmail, sendDigestEmail } from '../email-template';
import { env } from '@/config/env';

/**
 * Send welcome emails to users registered in the last 24h who haven't received one yet.
 */
export async function processWelcomeEmails() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const newUsers = await prisma.user.findMany({
    where: {
      createdAt: { gte: twoDaysAgo, lte: oneDayAgo },
      isVerified: true,
    },
    select: { id: true, email: true, fullName: true },
    take: 50,
  });

  let sent = 0;
  for (const user of newUsers) {
    try {
      await sendWelcomeEmail({
        to: user.email,
        name: user.fullName,
      });
      sent++;
    } catch {
      // continue
    }
  }
  return { sent, total: newUsers.length };
}

/**
 * Send weekly digest with new products and promos to subscribed users.
 */
export async function processWeeklyDigest() {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [newProducts, promoProducts] = await Promise.all([
    prisma.product.findMany({
      where: { createdAt: { gte: oneWeekAgo }, isActive: true },
      select: { name: true, slug: true, priceRetail: true },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.product.findMany({
      where: { isPromo: true, isActive: true },
      select: { name: true, slug: true, priceRetail: true, priceRetailOld: true },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    }),
  ]);

  if (newProducts.length === 0 && promoProducts.length === 0) {
    return { sent: 0, message: 'Немає нових товарів або акцій' };
  }

  const users = await prisma.user.findMany({
    where: { isVerified: true, isBlocked: false },
    select: { email: true, fullName: true },
    take: 500,
  });

  let sent = 0;
  for (const user of users) {
    try {
      await sendDigestEmail({
        to: user.email,
        name: user.fullName,
        newProducts: newProducts.map((p) => ({
          name: p.name,
          slug: p.slug,
          price: Number(p.priceRetail),
        })),
        promoProducts: promoProducts.map((p) => ({
          name: p.name,
          slug: p.slug,
          price: Number(p.priceRetail),
          oldPrice: p.priceRetailOld ? Number(p.priceRetailOld) : 0,
        })),
        period: 'тиждень',
      });
      sent++;
    } catch {
      // continue
    }
  }

  return { sent, total: users.length };
}
