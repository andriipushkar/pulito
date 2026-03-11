import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';
import {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteReadNotifications,
  cleanupExpiredNotifications,
  notifyOrderStatusChange,
} from './notification';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userNotification: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as MockPrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createNotification', () => {
  it('should create a notification', async () => {
    const mockNotification = { id: 1, userId: 1, title: 'Test' };
    mockPrisma.userNotification.create.mockResolvedValue(mockNotification as never);

    const result = await createNotification({
      userId: 1,
      type: 'system_notification',
      title: 'Test',
      message: 'Test message',
    });

    expect(result).toEqual(mockNotification);
    expect(mockPrisma.userNotification.create).toHaveBeenCalledWith({
      data: {
        userId: 1,
        notificationType: 'system_notification',
        title: 'Test',
        message: 'Test message',
        link: undefined,
      },
    });
  });

  it('should create notification with link', async () => {
    mockPrisma.userNotification.create.mockResolvedValue({} as never);

    await createNotification({
      userId: 1,
      type: 'order_status',
      title: 'Order Update',
      message: 'Status changed',
      link: '/account/orders/1',
    });

    expect(mockPrisma.userNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ link: '/account/orders/1' }),
    });
  });
});

describe('getUserNotifications', () => {
  it('should return notifications with total and unread count', async () => {
    const mockNotifications = [{ id: 1 }, { id: 2 }];
    mockPrisma.userNotification.findMany.mockResolvedValue(mockNotifications as never);
    mockPrisma.userNotification.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(3); // unread

    const result = await getUserNotifications(1);

    expect(result).toEqual({
      notifications: mockNotifications,
      total: 10,
      unreadCount: 3,
    });
  });

  it('should paginate correctly', async () => {
    mockPrisma.userNotification.findMany.mockResolvedValue([] as never);
    mockPrisma.userNotification.count.mockResolvedValue(0);

    await getUserNotifications(1, { page: 2, limit: 10 });

    expect(mockPrisma.userNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });
});

describe('getUnreadCount', () => {
  it('should return count of unread notifications', async () => {
    mockPrisma.userNotification.count.mockResolvedValue(5);

    const result = await getUnreadCount(1);
    expect(result).toBe(5);
    expect(mockPrisma.userNotification.count).toHaveBeenCalledWith({
      where: { userId: 1, isRead: false },
    });
  });
});

describe('markAsRead', () => {
  it('should mark a specific notification as read', async () => {
    mockPrisma.userNotification.updateMany.mockResolvedValue({ count: 1 } as never);

    await markAsRead(5, 1);
    expect(mockPrisma.userNotification.updateMany).toHaveBeenCalledWith({
      where: { id: 5, userId: 1 },
      data: expect.objectContaining({ isRead: true }),
    });
  });
});

describe('markAllAsRead', () => {
  it('should mark all unread notifications as read', async () => {
    mockPrisma.userNotification.updateMany.mockResolvedValue({ count: 3 } as never);

    await markAllAsRead(1);
    expect(mockPrisma.userNotification.updateMany).toHaveBeenCalledWith({
      where: { userId: 1, isRead: false },
      data: expect.objectContaining({ isRead: true }),
    });
  });
});

describe('notifyOrderStatusChange', () => {
  it('should create order status notification with correct label', async () => {
    mockPrisma.userNotification.create.mockResolvedValue({} as never);

    await notifyOrderStatusChange(1, 'ORD-001', 'shipped', 42);

    expect(mockPrisma.userNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 1,
        notificationType: 'order_status',
        title: 'Замовлення #ORD-001',
        message: 'Статус вашого замовлення змінено на "Відправлене"',
        link: '/account/orders/42',
      }),
    });
  });

  it('should handle unknown status gracefully', async () => {
    mockPrisma.userNotification.create.mockResolvedValue({} as never);

    await notifyOrderStatusChange(1, 'ORD-002', 'custom_status', 1);

    expect(mockPrisma.userNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        message: 'Статус вашого замовлення змінено на "custom_status"',
      }),
    });
  });

  it('should use correct label for each known status', async () => {
    mockPrisma.userNotification.create.mockResolvedValue({} as never);

    const knownStatuses: Record<string, string> = {
      processing: 'В обробці',
      confirmed: 'Підтверджене',
      paid: 'Оплачене',
      shipped: 'Відправлене',
      completed: 'Виконане',
      cancelled: 'Скасоване',
      returned: 'Повернення',
    };

    for (const [status, label] of Object.entries(knownStatuses)) {
      vi.clearAllMocks();
      mockPrisma.userNotification.create.mockResolvedValue({} as never);

      await notifyOrderStatusChange(1, 'ORD-X', status, 1);

      expect(mockPrisma.userNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          message: `Статус вашого замовлення змінено на "${label}"`,
        }),
      });
    }
  });
});

// ---------------------------------------------------------------------------
// deleteNotification
// ---------------------------------------------------------------------------

describe('deleteNotification', () => {
  it('should delete a specific notification for user', async () => {
    mockPrisma.userNotification.deleteMany.mockResolvedValue({ count: 1 } as never);

    const result = await deleteNotification(5, 1);

    expect(result).toEqual({ count: 1 });
    expect(mockPrisma.userNotification.deleteMany).toHaveBeenCalledWith({
      where: { id: 5, userId: 1 },
    });
  });

  it('should return count 0 when notification not found', async () => {
    mockPrisma.userNotification.deleteMany.mockResolvedValue({ count: 0 } as never);

    const result = await deleteNotification(999, 1);

    expect(result).toEqual({ count: 0 });
  });
});

// ---------------------------------------------------------------------------
// deleteReadNotifications
// ---------------------------------------------------------------------------

describe('deleteReadNotifications', () => {
  it('should delete all read notifications for user', async () => {
    mockPrisma.userNotification.deleteMany.mockResolvedValue({ count: 5 } as never);

    const result = await deleteReadNotifications(1);

    expect(result).toEqual({ count: 5 });
    expect(mockPrisma.userNotification.deleteMany).toHaveBeenCalledWith({
      where: { userId: 1, isRead: true },
    });
  });
});

// ---------------------------------------------------------------------------
// cleanupExpiredNotifications
// ---------------------------------------------------------------------------

describe('cleanupExpiredNotifications', () => {
  it('should delete read notifications older than default 90 days', async () => {
    mockPrisma.userNotification.deleteMany.mockResolvedValue({ count: 10 } as never);

    const result = await cleanupExpiredNotifications();

    expect(result).toEqual({ deleted: 10 });
    expect(mockPrisma.userNotification.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: expect.any(Date) },
        isRead: true,
      },
    });
  });

  it('should accept custom maxAgeDays parameter', async () => {
    mockPrisma.userNotification.deleteMany.mockResolvedValue({ count: 3 } as never);

    const result = await cleanupExpiredNotifications(30);

    expect(result).toEqual({ deleted: 3 });
  });
});

// ---------------------------------------------------------------------------
// getUserNotifications - default params
// ---------------------------------------------------------------------------

describe('getUserNotifications - default params', () => {
  it('should use default page 1 and limit 20 when no params provided', async () => {
    mockPrisma.userNotification.findMany.mockResolvedValue([] as never);
    mockPrisma.userNotification.count.mockResolvedValue(0);

    await getUserNotifications(1);

    expect(mockPrisma.userNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 })
    );
  });
});

// ---------------------------------------------------------------------------
// markAsRead - verify readAt is a Date
// ---------------------------------------------------------------------------

describe('markAsRead - readAt', () => {
  it('should set readAt to a Date instance', async () => {
    mockPrisma.userNotification.updateMany.mockResolvedValue({ count: 1 } as never);

    await markAsRead(1, 1);

    const call = mockPrisma.userNotification.updateMany.mock.calls[0][0];
    expect(call.data.readAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// markAllAsRead - verify readAt is a Date
// ---------------------------------------------------------------------------

describe('markAllAsRead - readAt', () => {
  it('should set readAt to a Date instance', async () => {
    mockPrisma.userNotification.updateMany.mockResolvedValue({ count: 3 } as never);

    await markAllAsRead(1);

    const call = mockPrisma.userNotification.updateMany.mock.calls[0][0];
    expect(call.data.readAt).toBeInstanceOf(Date);
  });
});
