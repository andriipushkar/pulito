import { prisma } from '@/lib/prisma';

type NotificationType =
  | 'order_status'
  | 'price_change'
  | 'back_in_stock'
  | 'promo'
  | 'system_notification';

/**
 * @description Створює нове сповіщення для користувача.
 * @param data - Дані сповіщення (userId, тип, заголовок, текст, посилання)
 * @returns Створене сповіщення
 */
export async function createNotification(data: {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  return prisma.userNotification.create({
    data: {
      userId: data.userId,
      notificationType: data.type,
      title: data.title,
      message: data.message,
      link: data.link,
    },
  });
}

/**
 * @description Отримує список сповіщень користувача з пагінацією та кількістю непрочитаних.
 * @param userId - Ідентифікатор користувача
 * @param params - Параметри пагінації (page, limit)
 * @returns Об'єкт зі списком сповіщень, загальною кількістю та кількістю непрочитаних
 */
export async function getUserNotifications(
  userId: number,
  params: { page?: number; limit?: number; filter?: string } = {},
) {
  const { page = 1, limit = 20, filter } = params;

  // Filter buckets: 'orders' = order_status; 'promo' = promo + price_change +
  // back_in_stock (anything commercial); 'other' = system, welcome, winback,
  // review_request, etc. Default = all.
  // Prisma enum filters are typed as the generated NotificationType[] — we
  // pass plain strings and cast via a Prisma input type.
  type WhereInput = Parameters<typeof prisma.userNotification.findMany>[0] extends
    | { where?: infer W }
    | undefined
    ? W
    : never;
  const types: Record<string, string[]> = {
    orders: ['order_status'],
    promo: ['promo', 'price_change', 'back_in_stock'],
    other: ['system_notification', 'welcome', 'winback', 'review_request'],
  };
  const where: WhereInput = (
    filter && types[filter] ? { userId, notificationType: { in: types[filter] } } : { userId }
  ) as WhereInput;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.userNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.userNotification.count({ where }),
    prisma.userNotification.count({ where: { userId, isRead: false } }),
  ]);

  return { notifications, total, unreadCount };
}

/**
 * @description Повертає кількість непрочитаних сповіщень користувача.
 * @param userId - Ідентифікатор користувача
 * @returns Кількість непрочитаних сповіщень
 */
export async function getUnreadCount(userId: number) {
  return prisma.userNotification.count({ where: { userId, isRead: false } });
}

/**
 * @description Позначає одне сповіщення як прочитане.
 * @param id - Ідентифікатор сповіщення
 * @param userId - Ідентифікатор користувача (для перевірки належності)
 * @returns Результат оновлення
 */
export async function markAsRead(id: number, userId: number) {
  return prisma.userNotification.updateMany({
    where: { id, userId },
    data: { isRead: true, readAt: new Date() },
  });
}

/**
 * @description Позначає всі сповіщення користувача як прочитані.
 * @param userId - Ідентифікатор користувача
 * @returns Результат оновлення
 */
export async function markAllAsRead(userId: number) {
  return prisma.userNotification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

/**
 * @description Видаляє одне сповіщення користувача.
 * @param id - Ідентифікатор сповіщення
 * @param userId - Ідентифікатор користувача (для перевірки належності)
 * @returns Результат видалення
 */
export async function deleteNotification(id: number, userId: number) {
  return prisma.userNotification.deleteMany({
    where: { id, userId },
  });
}

/**
 * @description Видаляє всі прочитані сповіщення користувача.
 * @param userId - Ідентифікатор користувача
 * @returns Результат видалення
 */
export async function deleteReadNotifications(userId: number) {
  return prisma.userNotification.deleteMany({
    where: { userId, isRead: true },
  });
}

/**
 * @description Видаляє прочитані сповіщення, старші за вказану кількість днів.
 * @param maxAgeDays - Максимальний вік сповіщень у днях (за замовчуванням 90)
 * @returns Об'єкт з кількістю видалених сповіщень
 */
export async function cleanupExpiredNotifications(maxAgeDays = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);

  const result = await prisma.userNotification.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      isRead: true,
    },
  });

  return { deleted: result.count };
}

/**
 * @description Створює сповіщення про зміну статусу замовлення для користувача.
 * @param userId - Ідентифікатор користувача
 * @param orderNumber - Номер замовлення
 * @param newStatus - Новий статус замовлення
 * @param orderId - Ідентифікатор замовлення
 * @returns Створене сповіщення
 */
export async function notifyOrderStatusChange(
  userId: number,
  orderNumber: string,
  newStatus: string,
  orderId: number,
) {
  const statusLabels: Record<string, string> = {
    processing: 'В обробці',
    confirmed: 'Підтверджене',
    paid: 'Оплачене',
    shipped: 'Відправлене',
    completed: 'Виконане',
    cancelled: 'Скасоване',
    returned: 'Повернення',
  };

  const label = statusLabels[newStatus] || newStatus;

  return createNotification({
    userId,
    type: 'order_status',
    title: `Замовлення #${orderNumber}`,
    message: `Статус вашого замовлення змінено на "${label}"`,
    link: `/account/orders/${orderId}`,
  });
}
