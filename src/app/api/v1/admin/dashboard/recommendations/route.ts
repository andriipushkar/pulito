import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { cacheGet, cacheSet } from '@/services/cache';
import { logger } from '@/lib/logger';

interface Recommendation {
  key: string;
  label: string;
  href: string;
  count: number;
  severity: 'info' | 'warning' | 'danger';
}

// 6 parallel count() queries cost ~10-50ms total. They're indexed and bounded, but
// dashboard recommendations don't need to be real-time — a 60s cache collapses
// concurrent admin tabs onto one round-trip.
const CACHE_KEY = 'admin:dashboard:recommendations:v1';
const CACHE_TTL = 60;

export const GET = withRole('admin', 'manager')(async (_request, { user }) => {
  try {
    const isAdmin = user.role === 'admin';
    // Manager-facing recommendations are cached separately so the 2FA hint
    // doesn't bleed into a manager's view via shared cache.
    const cacheKey = isAdmin ? `${CACHE_KEY}:admin` : `${CACHE_KEY}:manager`;
    const cached = await cacheGet<Recommendation[]>(cacheKey);
    if (cached) return successResponse(cached);

    const [
      productsNoImage,
      productsNoCategory,
      ordersUnpaid,
      categoriesNoDescription,
      adminsNo2fa,
      productsZeroSales,
    ] = await Promise.all([
      prisma.product.count({
        where: { isActive: true, imagePath: null },
      }),
      prisma.product.count({
        where: { isActive: true, categoryId: null },
      }),
      prisma.order.count({
        where: {
          status: { notIn: ['cancelled', 'returned', 'completed'] },
          paymentStatus: 'pending',
        },
      }).catch(() => 0),
      prisma.category.count({
        where: { OR: [{ description: null }, { description: '' }] },
      }).catch(() => 0),
      prisma.user.count({
        where: { role: 'admin', twoFactorEnabled: false },
      }).catch(() => 0),
      prisma.product.count({
        where: { isActive: true, ordersCount: 0 },
      }),
    ]);

    const recs: Recommendation[] = [];
    if (productsNoImage > 0) {
      recs.push({
        key: 'products_no_image',
        label: `${productsNoImage} активних товарів без головного фото`,
        href: '/admin/products?hasImage=false',
        count: productsNoImage,
        severity: productsNoImage > 20 ? 'warning' : 'info',
      });
    }
    if (productsNoCategory > 0) {
      recs.push({
        key: 'products_no_category',
        label: `${productsNoCategory} товарів без категорії`,
        href: '/admin/products?categoryId=none',
        count: productsNoCategory,
        severity: 'warning',
      });
    }
    if (ordersUnpaid > 0) {
      recs.push({
        key: 'orders_unpaid',
        label: `${ordersUnpaid} замовлень без оплати`,
        href: '/admin/orders?paid=false',
        count: ordersUnpaid,
        severity: ordersUnpaid > 5 ? 'danger' : 'warning',
      });
    }
    if (categoriesNoDescription > 0) {
      recs.push({
        key: 'categories_no_description',
        label: `${categoriesNoDescription} категорій без опису (погано для SEO)`,
        href: '/admin/categories',
        count: categoriesNoDescription,
        severity: 'info',
      });
    }
    // Surface "admins without 2FA" only to other admins. A manager seeing
    // this card is an info leak about admin-account hardening posture.
    if (adminsNo2fa > 0 && isAdmin) {
      recs.push({
        key: 'admins_no_2fa',
        label: `${adminsNo2fa} адмінів без 2FA`,
        href: '/admin/users?role=admin',
        count: adminsNo2fa,
        severity: 'danger',
      });
    }
    if (productsZeroSales > 0) {
      recs.push({
        key: 'products_zero_sales',
        label: `${productsZeroSales} активних товарів без жодного продажу`,
        href: '/admin/products?ordersCount=0',
        count: productsZeroSales,
        severity: 'info',
      });
    }

    // Order: danger > warning > info, then by count desc. Top 5 only.
    const order: Record<Recommendation['severity'], number> = {
      danger: 0,
      warning: 1,
      info: 2,
    };
    recs.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);

    const top = recs.slice(0, 5);
    await cacheSet(cacheKey, top, CACHE_TTL);
    return successResponse(top);
  } catch (err) {
    logger.error('[admin/dashboard/recommendations] GET failed', { error: err });
    return errorResponse('Не вдалося завантажити рекомендації', 500);
  }
});
