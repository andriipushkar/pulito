import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

export class UserError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'UserError';
  }
}

interface UserListParams {
  page?: number;
  limit?: number;
  role?: string;
  wholesaleStatus?: string;
  wholesaleGroup?: string;
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
  const { page = 1, limit = 20, role, wholesaleStatus, wholesaleGroup, search, sortBy, sortOrder, dateFrom, dateTo } = params;

  const where: Prisma.UserWhereInput = {};
  if (role) where.role = role as Prisma.EnumUserRoleFilter;
  if (wholesaleStatus) where.wholesaleStatus = wholesaleStatus as Prisma.EnumWholesaleStatusFilter;
  if (wholesaleGroup) where.wholesaleGroup = Number(wholesaleGroup);
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { fullName: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
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
  assignedManager: { select: { id: true, fullName: true, email: true } },
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
  adminId: number
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

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: adminId,
      actionType: 'user_edit',
      entityType: 'user',
      entityId: id,
      details: data,
    },
  });

  return updated;
}

// 2. Block/unblock user
export async function toggleBlockUser(
  id: number,
  block: boolean,
  reason: string | undefined,
  adminId: number
) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, isBlocked: true } });
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

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      actionType: block ? 'user_block' : 'user_unblock',
      entityType: 'user',
      entityId: id,
      details: { reason },
    },
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
export async function resetUserPassword(id: number, adminId: number) {
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

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      actionType: 'password_reset',
      entityType: 'user',
      entityId: id,
      details: { email: user.email },
    },
  });

  return { tempPassword, email: user.email };
}

// 6. Save admin note
export async function updateAdminNote(id: number, note: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw new UserError('Користувача не знайдено', 404);

  return prisma.user.update({
    where: { id },
    data: { adminNote: note || null },
    select: userDetailSelect,
  });
}

// 8. Get user stats (total purchases, avg check, last order)
export async function getUserStats(userId: number) {
  const [aggregate, lastOrder, orderCount] = await Promise.all([
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
    prisma.order.count({ where: { userId } }),
  ]);

  const totalPurchases = Number(aggregate._sum.totalAmount ?? 0);
  const completedOrders = aggregate._count;
  const avgCheck = completedOrders > 0 ? totalPurchases / completedOrders : 0;

  return {
    totalOrders: orderCount,
    completedOrders,
    totalPurchases,
    avgCheck,
    lastOrderDate: lastOrder?.createdAt || null,
  };
}

// 10. Get user audit log
export async function getUserAuditLog(userId: number, limit = 20) {
  return prisma.auditLog.findMany({
    where: {
      OR: [
        { userId },
        { entityType: 'user', entityId: userId },
      ],
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
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isVerified: true } });
  if (!user) throw new UserError('Користувача не знайдено', 404);
  if (user.isVerified) throw new UserError('Email вже верифіковано', 400);

  await prisma.user.update({ where: { id: userId }, data: { isVerified: true } });

  await prisma.auditLog.create({
    data: { userId: adminId, actionType: 'user_edit', entityType: 'user', entityId: userId, details: { action: 'manual_verify_email' } },
  });

  return { success: true };
}

// 2. Send message to user
export async function sendMessageToUser(
  userId: number,
  message: string,
  channels: ('email' | 'telegram' | 'viber')[],
  subject?: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, telegramChatId: true, viberUserId: true },
  });
  if (!user) throw new UserError('Користувача не знайдено', 404);

  const sent: string[] = [];

  if (channels.includes('email')) {
    try {
      const { sendEmail } = await import('@/services/email');
      await sendEmail({
        to: user.email,
        subject: subject || 'Повідомлення від магазину',
        html: `<p>Шановний(а) ${user.fullName},</p><p>${message.replace(/\n/g, '<br>')}</p>`,
      });
      sent.push('email');
    } catch { /* skip */ }
  }

  if (channels.includes('telegram') && user.telegramChatId) {
    try {
      const tg = await import('@/services/telegram');
      await tg.sendClientNotification(Number(user.telegramChatId), 'Сповіщення', message);
      sent.push('telegram');
    } catch { /* skip */ }
  }

  if (channels.includes('viber') && user.viberUserId) {
    try {
      const vb = await import('@/services/viber');
      await vb.sendViberNotification(Number(user.viberUserId), 'Сповіщення', message);
      sent.push('viber');
    } catch { /* skip */ }
  }

  if (sent.length === 0) throw new UserError('Не вдалося відправити жодним каналом', 400);

  return { sent };
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
      id: true, email: true, fullName: true, phone: true, role: true,
      companyName: true, edrpou: true, legalAddress: true, bankIban: true, bankName: true,
      ownershipType: true, taxSystem: true, wholesaleStatus: true, wholesaleGroup: true,
      isVerified: true, createdAt: true, updatedAt: true,
      orders: {
        select: { id: true, orderNumber: true, status: true, totalAmount: true, createdAt: true, contactName: true, contactPhone: true, contactEmail: true },
        orderBy: { createdAt: 'desc' },
      },
      addresses: true,
      wishlists: { include: { items: { include: { product: { select: { name: true, code: true } } } } } },
    },
  });
  if (!user) throw new UserError('Користувача не знайдено', 404);
  return user;
}

// 10. Delete user account (GDPR) — anonymize orders, delete personal data
export async function deleteUserAccount(userId: number, adminId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!user) throw new UserError('Користувача не знайдено', 404);
  if (user.role === 'admin') throw new UserError('Неможливо видалити адміністратора', 400);

  await prisma.$transaction(async (tx) => {
    // Anonymize orders
    await tx.order.updateMany({
      where: { userId },
      data: { userId: null },
    });

    // Delete related data
    await tx.cartItem.deleteMany({ where: { userId } });
    await tx.wishlist.deleteMany({ where: { userId } });
    await tx.recentlyViewed.deleteMany({ where: { userId } });
    await tx.userAddress.deleteMany({ where: { userId } });
    await tx.refreshToken.deleteMany({ where: { userId } });
    await tx.searchHistory.deleteMany({ where: { userId } });
    await tx.userNotification.deleteMany({ where: { userId } });

    // Audit before deletion
    await tx.auditLog.create({
      data: {
        userId: adminId,
        actionType: 'data_delete',
        entityType: 'user',
        entityId: userId,
        details: { email: user.email, deletedAt: new Date().toISOString() },
      },
    });

    // Delete the user
    await tx.user.delete({ where: { id: userId } });
  });

  return { success: true };
}

// Existing functions
export async function updateUserRole(id: number, role: string, adminId?: number) {
  const validRoles = ['client', 'wholesaler', 'manager', 'admin'];
  if (!validRoles.includes(role)) {
    throw new UserError('Невалідна роль', 400);
  }

  const oldUser = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!oldUser) throw new UserError('Користувача не знайдено', 404);

  const updated = await prisma.user.update({
    where: { id },
    data: { role: role as 'client' | 'wholesaler' | 'manager' | 'admin' },
    select: userSelect,
  });

  if (adminId) {
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        actionType: 'role_change',
        entityType: 'user',
        entityId: id,
        details: { oldRole: oldUser.role, newRole: role },
      },
    });
  }

  return updated;
}

export async function approveWholesale(userId: number, managerId?: number, wholesaleGroup?: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { wholesaleStatus: true },
  });

  if (!user) throw new UserError('Користувача не знайдено', 404);
  if (user.wholesaleStatus !== 'pending') {
    throw new UserError('Запит не очікує розгляду', 400);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      role: 'wholesaler',
      wholesaleStatus: 'approved',
      wholesaleApprovedDate: new Date(),
      wholesaleGroup: wholesaleGroup || 1,
      assignedManagerId: managerId || undefined,
    },
    select: userSelect,
  });

  if (managerId) {
    await prisma.auditLog.create({
      data: {
        userId: managerId,
        actionType: 'wholesale_approve',
        entityType: 'user',
        entityId: userId,
        details: { wholesaleGroup: wholesaleGroup || 1 },
      },
    });
  }

  return updated;
}

export async function rejectWholesale(userId: number, managerId?: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { wholesaleStatus: true },
  });

  if (!user) throw new UserError('Користувача не знайдено', 404);
  if (user.wholesaleStatus !== 'pending') {
    throw new UserError('Запит не очікує розгляду', 400);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { wholesaleStatus: 'rejected' },
    select: userSelect,
  });

  if (managerId) {
    await prisma.auditLog.create({
      data: {
        userId: managerId,
        actionType: 'wholesale_reject',
        entityType: 'user',
        entityId: userId,
      },
    });
  }

  return updated;
}
