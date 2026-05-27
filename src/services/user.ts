import { Prisma, UserRole } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { logAudit } from '@/services/audit';
import { maskUserEditDetails } from '@/utils/pii';
import { phoneSearchVariants } from '@/utils/phone';

export class UserError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'UserError';
  }
}

interface UserListParams {
  page?: number;
  limit?: number;
  role?: string;
  roles?: string[];
  wholesaleStatus?: string;
  wholesaleGroup?: string;
  isBlocked?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  dateFrom?: string;
  dateTo?: string;
}

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  companyName: true,
  edrpou: true,
  wholesaleStatus: true,
  wholesaleGroup: true,
  wholesaleRequestDate: true,
  isVerified: true,
  isBlocked: true,
  createdAt: true,
  _count: { select: { orders: true } },
} satisfies Prisma.UserSelect;

export async function getAllUsers(params: UserListParams = {}) {
  const {
    page = 1,
    limit = 20,
    role,
    roles,
    wholesaleStatus,
    wholesaleGroup,
    isBlocked,
    search,
    sortBy,
    sortOrder,
    dateFrom,
    dateTo,
  } = params;

  const where: Prisma.UserWhereInput = {};
  if (roles && roles.length > 0) {
    where.role = { in: roles as UserRole[] };
  } else if (role) {
    where.role = role as Prisma.EnumUserRoleFilter;
  }
  if (wholesaleStatus) where.wholesaleStatus = wholesaleStatus as Prisma.EnumWholesaleStatusFilter;
  if (wholesaleGroup !== undefined && wholesaleGroup !== null && String(wholesaleGroup) !== '') {
    const group = Number(wholesaleGroup);
    // Wholesale groups are 1..3 by business rule. Anything else is an
    // input bug (e.g. `?wholesaleGroup=abc` → NaN). Reject loudly instead
    // of silently filtering to nothing.
    if (![1, 2, 3].includes(group)) {
      throw new UserError('Гуртова група має бути 1, 2 або 3', 400);
    }
    where.wholesaleGroup = group;
  }
  if (typeof isBlocked === 'boolean') where.isBlocked = isBlocked;
  if (search) {
    // Phone variants let "0961234567" match a stored "+380961234567" (and vice versa).
    const phoneVariants = phoneSearchVariants(search);
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { fullName: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      ...phoneVariants.map((v) => ({ phone: { contains: v } })),
    ];
  }
  if (dateFrom) {
    where.createdAt = { ...(where.createdAt as object), gte: new Date(dateFrom) };
  }
  if (dateTo) {
    where.createdAt = { ...(where.createdAt as object), lte: new Date(dateTo) };
  }

  // Dynamic sorting
  let orderBy: Prisma.UserOrderByWithRelationInput;
  switch (sortBy) {
    case 'fullName':
      orderBy = { fullName: (sortOrder as 'asc' | 'desc') || 'asc' };
      break;
    case 'orders':
      orderBy = { orders: { _count: (sortOrder as 'asc' | 'desc') || 'desc' } };
      break;
    case 'createdAt':
    default:
      orderBy = { createdAt: (sortOrder as 'asc' | 'desc') || 'desc' };
      break;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}

const userDetailSelect = {
  ...userSelect,
  legalAddress: true,
  bankIban: true,
  bankName: true,
  bankMfo: true,
  ownershipType: true,
  taxSystem: true,
  contactPersonName: true,
  contactPersonPhone: true,
  wholesaleApprovedDate: true,
  wholesaleMonthlyVol: true,
  assignedManagerId: true,
  assignedManager: {
    select: { id: true, fullName: true, email: true, phone: true, telegramUsername: true },
  },
  notificationPrefs: true,
  avatarUrl: true,
  isBlocked: true,
  blockedAt: true,
  blockedReason: true,
  adminNote: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export async function getUserById(id: number) {
  return prisma.user.findUnique({
    where: { id },
    select: userDetailSelect,
  });
}

// 1. Edit user profile
export async function updateUserProfile(
  id: number,
  data: {
    fullName?: string;
    phone?: string;
    email?: string;
    companyName?: string;
    edrpou?: string;
    legalAddress?: string;
  },
  adminId: number,
) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
  if (!user) throw new UserError('Користувача не знайдено', 404);

  // Check email uniqueness if changing
  if (data.email && data.email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new UserError('Цей email вже зайнятий', 400);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(data.fullName !== undefined && { fullName: data.fullName }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.companyName !== undefined && { companyName: data.companyName || null }),
      ...(data.edrpou !== undefined && { edrpou: data.edrpou || null }),
      ...(data.legalAddress !== undefined && { legalAddress: data.legalAddress || null }),
    },
    select: userDetailSelect,
  });

  await logAudit({
    userId: adminId,
    actionType: 'user_edit',
    entityType: 'user',
    entityId: id,
    details: maskUserEditDetails(data as Record<string, unknown>),
  });

  return updated;
}

// 2. Block/unblock user
export async function toggleBlockUser(
  id: number,
  block: boolean,
  reason: string | undefined,
  adminId: number,
  meta?: { ipAddress?: string },
) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, isBlocked: true },
  });
  if (!user) throw new UserError('Користувача не знайдено', 404);

  const updated = await prisma.user.update({
    where: { id },
    data: block
      ? { isBlocked: true, blockedAt: new Date(), blockedReason: reason || null }
      : { isBlocked: false, blockedAt: null, blockedReason: null },
    select: userDetailSelect,
  });

  // Invalidate refresh tokens on block
  if (block) {
    await prisma.refreshToken.deleteMany({ where: { userId: id } });
  }

  await logAudit({
    userId: adminId,
    actionType: block ? 'user_block' : 'user_unblock',
    entityType: 'user',
    entityId: id,
    details: { reason: reason ?? null },
    ipAddress: meta?.ipAddress,
  });

  return updated;
}

// 3. Get user orders (for detail page)
export async function getUserOrders(userId: number, limit = 10) {
  return prisma.order.findMany({
    where: { userId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
      itemsCount: true,
      createdAt: true,
      paymentStatus: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// 4. Reset password
export async function resetUserPassword(
  id: number,
  adminId: number,
  meta?: { ipAddress?: string },
) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
  if (!user) throw new UserError('Користувача не знайдено', 404);

  // Generate temp password
  const tempPassword = randomBytes(4).toString('hex'); // 8 chars
  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });

  // Invalidate all sessions
  await prisma.refreshToken.deleteMany({ where: { userId: id } });

  await logAudit({
    userId: adminId,
    actionType: 'password_reset',
    entityType: 'user',
    entityId: id,
    details: { email: user.email },
    ipAddress: meta?.ipAddress,
  });

  return { tempPassword, email: user.email };
}

// 6. Save admin note
const ADMIN_NOTE_MAX = 5_000;
export async function updateAdminNote(id: number, note: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw new UserError('Користувача не знайдено', 404);

  if (note && note.length > ADMIN_NOTE_MAX) {
    throw new UserError(`Нотатка занадто довга (макс ${ADMIN_NOTE_MAX} символів)`, 400);
  }

  return prisma.user.update({
    where: { id },
    data: { adminNote: note || null },
    select: userDetailSelect,
  });
}

// 8. Get user stats (total purchases, avg check, last order)
export async function getUserStats(userId: number) {
  const [aggregate, lastOrder, firstOrder, orderCount] = await Promise.all([
    prisma.order.aggregate({
      where: { userId, status: { notIn: ['cancelled', 'returned'] } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.order.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.order.findFirst({
      where: { userId, status: { notIn: ['cancelled', 'returned'] } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.order.count({ where: { userId } }),
  ]);

  const totalPurchases = Number(aggregate._sum.totalAmount ?? 0);
  const completedOrders = aggregate._count;
  const avgCheck = completedOrders > 0 ? totalPurchases / completedOrders : 0;

  // ── LTV prediction (12-month, recency-decayed)
  // Conservative model: extrapolate observed order frequency over 12 months,
  // decay by how long since the last order so dormant customers don't inflate.
  const now = Date.now();
  const daysSinceLastOrder = lastOrder
    ? Math.max(0, Math.floor((now - lastOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24)))
    : null;
  const daysSinceFirstOrder = firstOrder
    ? Math.max(1, Math.floor((now - firstOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  let predictedLtv12mo = 0;
  if (completedOrders > 0 && daysSinceFirstOrder !== null && daysSinceLastOrder !== null) {
    const ordersPerYear = (completedOrders / daysSinceFirstOrder) * 365;
    // grace period of 60d before recency starts pulling down the projection
    const recencyMultiplier = Math.max(0.1, 1 - Math.max(0, daysSinceLastOrder - 60) / 365);
    predictedLtv12mo = Math.round(avgCheck * ordersPerYear * recencyMultiplier);
  }

  // ── Segments (RFM-style buckets, mutually-exclusive priorities)
  const segments: string[] = [];
  if (completedOrders === 0) {
    segments.push('no-orders');
  } else if (daysSinceLastOrder !== null && daysSinceLastOrder > 180) {
    segments.push('churned');
  } else if (daysSinceLastOrder !== null && daysSinceLastOrder > 90) {
    segments.push('at-risk');
  } else if (completedOrders >= 5 && totalPurchases >= 10000) {
    segments.push('vip');
  } else if (completedOrders >= 3) {
    segments.push('loyal');
  } else if (daysSinceFirstOrder !== null && daysSinceFirstOrder < 60 && completedOrders >= 1) {
    segments.push('new');
  } else if (completedOrders === 1) {
    segments.push('one-time');
  }

  return {
    totalOrders: orderCount,
    completedOrders,
    totalPurchases,
    avgCheck,
    lastOrderDate: lastOrder?.createdAt || null,
    firstOrderDate: firstOrder?.createdAt || null,
    daysSinceLastOrder,
    predictedLtv12mo,
    segments,
  };
}

/**
 * Unified activity timeline — merges orders, reviews, audit-log entries, and key
 * client events into one chronological feed for Customer 360 view.
 */
export async function getUserTimeline(userId: number, limit = 50) {
  const [orders, reviews, auditEntries, events] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        itemsCount: true,
        createdAt: true,
      },
    }),
    prisma.review.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        product: { select: { id: true, name: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { OR: [{ userId }, { entityType: 'user', entityId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        actionType: true,
        details: true,
        createdAt: true,
      },
    }),
    prisma.clientEvent.findMany({
      where: {
        userId,
        eventType: { in: ['order_completed', 'product_view', 'add_to_cart', 'checkout_started'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        eventType: true,
        metadata: true,
        createdAt: true,
        productId: true,
        product: { select: { id: true, name: true } },
      },
    }),
  ]);

  type TimelineEntry = {
    id: string;
    kind: 'order' | 'review' | 'audit' | 'event';
    at: Date;
    title: string;
    body?: string;
    href?: string;
  };

  const entries: TimelineEntry[] = [];

  for (const o of orders) {
    entries.push({
      id: `order-${o.id}`,
      kind: 'order',
      at: o.createdAt,
      title: `Замовлення #${o.orderNumber}`,
      body: `${Number(o.itemsCount)} товар(ів) · ${Number(o.totalAmount).toFixed(0)} ₴ · ${o.status}`,
      href: `/admin/orders/${o.id}`,
    });
  }
  for (const r of reviews) {
    entries.push({
      id: `review-${r.id}`,
      kind: 'review',
      at: r.createdAt,
      title: `Відгук ${r.rating}/5 на «${r.product.name}»`,
      body: r.comment ?? r.title ?? undefined,
      href: r.product.id ? `/admin/products/${r.product.id}` : undefined,
    });
  }
  for (const a of auditEntries) {
    entries.push({
      id: `audit-${a.id}`,
      kind: 'audit',
      at: a.createdAt,
      title: a.actionType,
      body:
        a.details && typeof a.details === 'object'
          ? Object.entries(a.details as Record<string, unknown>)
              .filter(([, v]) => v !== undefined && v !== null && v !== '')
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ') || undefined
          : undefined,
    });
  }
  for (const ev of events) {
    entries.push({
      id: `event-${ev.id}`,
      kind: 'event',
      at: ev.createdAt,
      title: ev.eventType,
      body: ev.product ? `«${ev.product.name}»` : undefined,
      href: ev.product?.id ? `/admin/products/${ev.product.id}` : undefined,
    });
  }

  entries.sort((a, b) => b.at.getTime() - a.at.getTime());
  return entries.slice(0, limit);
}

// 10. Get user audit log
export async function getUserAuditLog(userId: number, limit = 20) {
  return prisma.auditLog.findMany({
    where: {
      OR: [{ userId }, { entityType: 'user', entityId: userId }],
    },
    select: {
      id: true,
      actionType: true,
      entityType: true,
      details: true,
      ipAddress: true,
      createdAt: true,
      user: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// 1. Manual email verification
export async function verifyUserEmail(userId: number, adminId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isVerified: true },
  });
  if (!user) throw new UserError('Користувача не знайдено', 404);
  if (user.isVerified) throw new UserError('Email вже верифіковано', 400);

  await prisma.user.update({ where: { id: userId }, data: { isVerified: true } });

  await logAudit({
    userId: adminId,
    actionType: 'user_edit',
    entityType: 'user',
    entityId: userId,
    details: { action: 'manual_verify_email' },
  });

  return { success: true };
}

// 2. Send message to user
export async function sendMessageToUser(
  userId: number,
  message: string,
  channels: ('email' | 'telegram' | 'viber')[],
  subject?: string,
): Promise<{
  sent: string[];
  failed: { channel: string; reason: string }[];
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, telegramChatId: true, viberUserId: true },
  });
  if (!user) throw new UserError('Користувача не знайдено', 404);

  const sent: string[] = [];
  const failed: { channel: string; reason: string }[] = [];

  if (channels.includes('email')) {
    try {
      const { sendEmail } = await import('@/services/email');
      await sendEmail({
        to: user.email,
        subject: subject || 'Повідомлення від магазину',
        html: `<p>Шановний(а) ${user.fullName},</p><p>${message.replace(/\n/g, '<br>')}</p>`,
      });
      sent.push('email');
    } catch (err) {
      failed.push({ channel: 'email', reason: err instanceof Error ? err.message : 'unknown' });
    }
  }

  if (channels.includes('telegram')) {
    if (!user.telegramChatId) {
      failed.push({ channel: 'telegram', reason: 'no telegramChatId' });
    } else {
      try {
        const tg = await import('@/services/telegram');
        await tg.sendClientNotification(Number(user.telegramChatId), 'Сповіщення', message);
        sent.push('telegram');
      } catch (err) {
        failed.push({
          channel: 'telegram',
          reason: err instanceof Error ? err.message : 'unknown',
        });
      }
    }
  }

  if (channels.includes('viber')) {
    if (!user.viberUserId) {
      failed.push({ channel: 'viber', reason: 'no viberUserId' });
    } else {
      try {
        const vb = await import('@/services/viber');
        await vb.sendViberNotification(Number(user.viberUserId), 'Сповіщення', message);
        sent.push('viber');
      } catch (err) {
        failed.push({ channel: 'viber', reason: err instanceof Error ? err.message : 'unknown' });
      }
    }
  }

  if (sent.length === 0) throw new UserError('Не вдалося відправити жодним каналом', 400);

  return { sent, failed };
}

// 4. Get user wishlist
export async function getUserWishlist(userId: number) {
  const items = await prisma.wishlistItem.findMany({
    where: { wishlist: { userId } },
    select: {
      id: true,
      addedAt: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          priceRetail: true,
          quantity: true,
          isActive: true,
          imagePath: true,
        },
      },
    },
    orderBy: { addedAt: 'desc' },
  });
  return items.map((item) => ({
    id: item.id,
    createdAt: item.addedAt,
    product: {
      id: item.product.id,
      name: item.product.name,
      slug: item.product.slug,
      price: Number(item.product.priceRetail),
      imageUrl: item.product.imagePath,
      inStock: item.product.isActive && item.product.quantity > 0,
    },
  }));
}

// 5. Get recently viewed
export async function getUserRecentlyViewed(userId: number, limit = 20) {
  const items = await prisma.recentlyViewed.findMany({
    where: { userId },
    select: {
      id: true,
      viewedAt: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          priceRetail: true,
          imagePath: true,
        },
      },
    },
    orderBy: { viewedAt: 'desc' },
    take: limit,
  });
  return items.map((item) => ({
    id: item.id,
    viewedAt: item.viewedAt,
    product: {
      id: item.product.id,
      name: item.product.name,
      slug: item.product.slug,
      price: Number(item.product.priceRetail),
      imageUrl: item.product.imagePath,
    },
  }));
}

// 6. Get user addresses
export async function getUserAddresses(userId: number) {
  return prisma.userAddress.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
}

// 9. Export all user data (GDPR)
export async function exportUserData(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      companyName: true,
      edrpou: true,
      legalAddress: true,
      bankIban: true,
      bankName: true,
      ownershipType: true,
      taxSystem: true,
      wholesaleStatus: true,
      wholesaleGroup: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
      orders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          contactName: true,
          contactPhone: true,
          contactEmail: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      addresses: true,
      wishlists: {
        include: { items: { include: { product: { select: { name: true, code: true } } } } },
      },
      reviews: {
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          product: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!user) throw new UserError('Користувача не знайдено', 404);

  // Feedback isn't linked by userId in the schema — match by email so the
  // GDPR export is complete. We accept that feedback from an email that
  // someone else later registers with shows up in the user's export; this is
  // intentionally conservative for compliance.
  const feedback = user.email
    ? await prisma.feedback.findMany({
        where: { email: user.email },
        select: {
          id: true,
          name: true,
          phone: true,
          subject: true,
          message: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  return { ...user, feedback };
}

// 10. Delete user account (GDPR) — anonymize orders, delete personal data
export async function deleteUserAccount(
  userId: number,
  adminId: number,
  meta?: { ipAddress?: string },
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!user) throw new UserError('Користувача не знайдено', 404);
  if (user.role === 'admin') throw new UserError('Неможливо видалити адміністратора', 400);

  await prisma.$transaction(async (tx) => {
    // Anonymize orders: detach userId AND scrub the snapshot contact fields.
    // Leaving contactName/Phone/Email in the row keeps the customer's PII
    // recoverable from order history — a GDPR violation. Required string
    // columns get a redaction marker; optional ones go null.
    await tx.order.updateMany({
      where: { userId },
      data: {
        userId: null,
        contactName: '[видалений користувач]',
        contactPhone: '[redacted]',
        contactEmail: '[redacted]',
      },
    });
    // Nullable PII fields go null in a separate call (updateMany typing rejects
    // mixing string-required and nullable scrubbing in one shot for some rows).
    await tx.order.updateMany({
      where: { contactName: '[видалений користувач]' },
      data: {
        companyName: null,
        edrpou: null,
        deliveryAddress: null,
        deliveryFlat: null,
        deliveryBuilding: null,
      },
    });

    // Delete related data
    await tx.cartItem.deleteMany({ where: { userId } });
    await tx.wishlist.deleteMany({ where: { userId } });
    await tx.recentlyViewed.deleteMany({ where: { userId } });
    await tx.userAddress.deleteMany({ where: { userId } });
    await tx.refreshToken.deleteMany({ where: { userId } });
    await tx.searchHistory.deleteMany({ where: { userId } });
    await tx.userNotification.deleteMany({ where: { userId } });

    // Audit before deletion — keep the row even if the user is deleted by this tx
    await logAudit(
      {
        userId: adminId,
        actionType: 'data_delete',
        entityType: 'user',
        entityId: userId,
        details: { email: user.email, deletedAt: new Date().toISOString() },
        ipAddress: meta?.ipAddress,
      },
      tx,
    );

    // Delete the user
    await tx.user.delete({ where: { id: userId } });
  });

  return { success: true };
}

// Existing functions
export async function updateUserRole(
  id: number,
  role: string,
  adminId?: number,
  wholesaleGroup?: number | null,
) {
  const validRoles = ['client', 'wholesaler', 'manager', 'admin'];
  if (!validRoles.includes(role)) {
    throw new UserError('Невалідна роль', 400);
  }
  if (
    wholesaleGroup !== undefined &&
    wholesaleGroup !== null &&
    ![1, 2, 3].includes(wholesaleGroup)
  ) {
    throw new UserError('Гуртова група має бути 1, 2 або 3', 400);
  }

  const oldUser = await prisma.user.findUnique({
    where: { id },
    select: { role: true, wholesaleGroup: true },
  });
  if (!oldUser) throw new UserError('Користувача не знайдено', 404);

  // Self-demotion guard: an admin trying to lower their own role would lock
  // them out of the panel mid-session. Force them to nominate another admin
  // first (or use a different account to demote). Self-actions on other
  // fields (name, email) are fine — only role flip is blocked.
  if (adminId && adminId === id && oldUser.role === 'admin' && role !== 'admin') {
    throw new UserError(
      'Ви не можете знизити свою роль самостійно — інший адмін має це зробити',
      400,
    );
  }

  // Last-admin protection: never let the system slip below 1 admin. Lose
  // the last one and nobody can sign back in to recreate them.
  if (oldUser.role === 'admin' && role !== 'admin') {
    const adminCount = await prisma.user.count({ where: { role: 'admin' } });
    if (adminCount <= 1) {
      throw new UserError(
        'Це останній адмін у системі. Створіть другого адміна перед зниженням ролі.',
        400,
      );
    }
  }

  // Set role + wholesale group atomically so the dropdown can promote a user
  // straight into a pricing tier without two round-trips.
  const data: {
    role: 'client' | 'wholesaler' | 'manager' | 'admin';
    wholesaleGroup?: number | null;
  } = {
    role: role as 'client' | 'wholesaler' | 'manager' | 'admin',
  };
  if (wholesaleGroup !== undefined) data.wholesaleGroup = wholesaleGroup;

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: userSelect,
  });

  if (adminId) {
    await logAudit({
      userId: adminId,
      actionType: 'role_change',
      entityType: 'user',
      entityId: id,
      details: {
        oldRole: oldUser.role,
        newRole: role,
        oldGroup: oldUser.wholesaleGroup,
        newGroup: wholesaleGroup ?? oldUser.wholesaleGroup ?? null,
      },
    });
  }

  return updated;
}

export async function approveWholesale(
  userId: number,
  managerId?: number,
  wholesaleGroup?: number,
) {
  // Validate group input before hitting the DB — UI dropdown caps to 1..3 but
  // direct API callers can still pass anything.
  const group = wholesaleGroup ?? 1;
  if (![1, 2, 3].includes(group)) {
    throw new UserError('Гуртова група має бути 1, 2 або 3', 400);
  }

  // Atomic guard: only flip status if it's still `pending`. Two simultaneous
  // approvals (or an approval racing a rejection) collapse to a single winner;
  // the loser sees `count: 0` and we surface a 409 so the UI can refresh.
  const result = await prisma.user.updateMany({
    where: { id: userId, wholesaleStatus: 'pending' },
    data: {
      role: 'wholesaler',
      wholesaleStatus: 'approved',
      wholesaleApprovedDate: new Date(),
      wholesaleGroup: group,
      assignedManagerId: managerId || undefined,
    },
  });

  if (result.count === 0) {
    // Differentiate "not found" from "already processed" for clearer UX.
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { wholesaleStatus: true },
    });
    if (!existing) throw new UserError('Користувача не знайдено', 404);
    throw new UserError('Запит уже опрацьовано іншим адміністратором', 409);
  }

  const updated = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: userSelect,
  });

  // Always log — when managerId is missing (e.g. cron auto-approval),
  // record userId: null so the audit row still exists with the actor "system".
  await logAudit({
    userId: managerId ?? null,
    actionType: 'wholesale_approve',
    entityType: 'user',
    entityId: userId,
    details: { wholesaleGroup: group, actor: managerId ? 'manager' : 'system' },
  });

  return updated;
}

export async function rejectWholesale(userId: number, managerId?: number) {
  const result = await prisma.user.updateMany({
    where: { id: userId, wholesaleStatus: 'pending' },
    data: { wholesaleStatus: 'rejected' },
  });

  if (result.count === 0) {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { wholesaleStatus: true },
    });
    if (!existing) throw new UserError('Користувача не знайдено', 404);
    throw new UserError('Запит уже опрацьовано іншим адміністратором', 409);
  }

  const updated = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: userSelect,
  });

  if (managerId) {
    await logAudit({
      userId: managerId,
      actionType: 'wholesale_reject',
      entityType: 'user',
      entityId: userId,
    });
  }

  return updated;
}
