import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSendEmail = vi.fn().mockResolvedValue(undefined);
const mockSendClientNotification = vi.fn().mockResolvedValue(undefined);
const mockSendViberNotification = vi.fn().mockResolvedValue(undefined);
const mockSendPushNotification = vi.fn().mockResolvedValue(undefined);

vi.mock('./email', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock('./telegram', () => ({
  sendClientNotification: (...args: unknown[]) => mockSendClientNotification(...args),
}));

vi.mock('./viber', () => ({
  sendViberNotification: (...args: unknown[]) => mockSendViberNotification(...args),
}));

vi.mock('./push', () => ({
  sendPushNotification: (...args: unknown[]) => mockSendPushNotification(...args),
}));

const mockFindMany = vi.fn();
const mockUpdate = vi.fn().mockResolvedValue({});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userNotification: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

import { processNotificationQueue } from './notification-queue';

function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'Test Title',
    message: 'Test message',
    notificationType: 'order_status',
    link: '/orders/1',
    retryCount: 0,
    user: {
      id: 1,
      email: 'user@test.com',
      telegramChatId: null,
      viberUserId: null,
      notificationPrefs: {},
    },
    ...overrides,
  };
}

describe('processNotificationQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns zeros when no notifications pending', async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await processNotificationQueue();
    expect(result).toEqual({ sent: 0, failed: 0, deadLetters: 0 });
  });

  it('sends email and marks as dispatched', async () => {
    mockFindMany.mockResolvedValue([makeNotification()]);
    const result = await processNotificationQueue();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { dispatched: true },
    });
    expect(result.sent).toBe(1);
  });

  it('skips email when preference is false', async () => {
    mockFindMany.mockResolvedValue([
      makeNotification({
        user: {
          id: 1,
          email: 'user@test.com',
          telegramChatId: null,
          viberUserId: null,
          notificationPrefs: { email_orders: false },
        },
      }),
    ]);
    await processNotificationQueue();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('sends telegram for promo type with chatId', async () => {
    mockFindMany.mockResolvedValue([
      makeNotification({
        notificationType: 'promo',
        user: {
          id: 1,
          email: null,
          telegramChatId: '12345',
          viberUserId: null,
          notificationPrefs: {},
        },
      }),
    ]);
    await processNotificationQueue();
    expect(mockSendClientNotification).toHaveBeenCalledTimes(1);
  });

  it('skips telegram for order_status type (sent inline)', async () => {
    mockFindMany.mockResolvedValue([
      makeNotification({
        notificationType: 'order_status',
        user: {
          id: 1,
          email: null,
          telegramChatId: '12345',
          viberUserId: null,
          notificationPrefs: {},
        },
      }),
    ]);
    await processNotificationQueue();
    expect(mockSendClientNotification).not.toHaveBeenCalled();
  });

  it('retries on email failure with exponential backoff', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('SMTP error'));
    mockSendPushNotification.mockRejectedValueOnce(new Error('Push error'));
    mockFindMany.mockResolvedValue([makeNotification({ user: { id: 1, email: 'user@test.com', telegramChatId: null, viberUserId: null, notificationPrefs: {} } })]);
    const result = await processNotificationQueue();
    expect(result.failed).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          retryCount: 1,
          nextRetryAt: expect.any(Date),
          lastError: expect.stringContaining('email'),
        }),
      })
    );
  });

  it('marks as dead letter after max retries', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('SMTP error'));
    mockSendPushNotification.mockRejectedValueOnce(new Error('Push error'));
    mockFindMany.mockResolvedValue([
      makeNotification({
        retryCount: 4,
        user: { id: 1, email: 'user@test.com', telegramChatId: null, viberUserId: null, notificationPrefs: {} },
      }),
    ]);
    const result = await processNotificationQueue();
    expect(result.deadLetters).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          retryCount: 5,
          dispatched: true,
          lastError: expect.any(String),
        }),
      })
    );
  });

  it('sends viber for promo type with viberUserId', async () => {
    mockFindMany.mockResolvedValue([
      makeNotification({
        notificationType: 'promo',
        user: {
          id: 1,
          email: null,
          telegramChatId: null,
          viberUserId: 'viber-123',
          notificationPrefs: {},
        },
      }),
    ]);
    await processNotificationQueue();
    expect(mockSendViberNotification).toHaveBeenCalledTimes(1);
  });

  it('always attempts push notification', async () => {
    mockFindMany.mockResolvedValue([makeNotification()]);
    await processNotificationQueue();
    expect(mockSendPushNotification).toHaveBeenCalledTimes(1);
  });

  it('skips viber for order_status type (sent inline)', async () => {
    mockFindMany.mockResolvedValue([
      makeNotification({
        notificationType: 'order_status',
        user: {
          id: 1,
          email: null,
          telegramChatId: null,
          viberUserId: 'viber-123',
          notificationPrefs: {},
        },
      }),
    ]);
    await processNotificationQueue();
    expect(mockSendViberNotification).not.toHaveBeenCalled();
  });

  it('skips telegram when preference is false', async () => {
    mockFindMany.mockResolvedValue([
      makeNotification({
        notificationType: 'promo',
        user: {
          id: 1,
          email: null,
          telegramChatId: '12345',
          viberUserId: null,
          notificationPrefs: { telegram_promo: false },
        },
      }),
    ]);
    await processNotificationQueue();
    expect(mockSendClientNotification).not.toHaveBeenCalled();
  });

  it('skips viber when preference is false', async () => {
    mockFindMany.mockResolvedValue([
      makeNotification({
        notificationType: 'promo',
        user: {
          id: 1,
          email: null,
          telegramChatId: null,
          viberUserId: 'viber-123',
          notificationPrefs: { viber_promo: false },
        },
      }),
    ]);
    await processNotificationQueue();
    expect(mockSendViberNotification).not.toHaveBeenCalled();
  });

  it('handles push notification failure silently', async () => {
    mockSendPushNotification.mockRejectedValueOnce(new Error('Push error'));
    mockFindMany.mockResolvedValue([makeNotification({ user: { id: 1, email: null, telegramChatId: null, viberUserId: null, notificationPrefs: {} } })]);
    const result = await processNotificationQueue();
    expect(result).toBeDefined();
  });

  it('handles notification with no link', async () => {
    mockFindMany.mockResolvedValue([makeNotification({ link: null })]);
    await processNotificationQueue();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it('handles unknown notification type using default pref keys', async () => {
    mockFindMany.mockResolvedValue([
      makeNotification({
        notificationType: 'system_alert',
        user: {
          id: 1,
          email: 'user@test.com',
          telegramChatId: null,
          viberUserId: null,
          notificationPrefs: {},
        },
      }),
    ]);
    await processNotificationQueue();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it('sends email with link content when link is present', async () => {
    mockFindMany.mockResolvedValue([
      makeNotification({
        link: '/orders/123',
        user: {
          id: 1,
          email: 'user@test.com',
          telegramChatId: null,
          viberUserId: null,
          notificationPrefs: {},
        },
      }),
    ]);
    await processNotificationQueue();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const htmlArg = mockSendEmail.mock.calls[0][0].html;
    expect(htmlArg).toContain('/orders/123');
  });

  it('handles null notificationPrefs', async () => {
    mockFindMany.mockResolvedValue([
      makeNotification({
        user: {
          id: 1,
          email: 'user@test.com',
          telegramChatId: null,
          viberUserId: null,
          notificationPrefs: null,
        },
      }),
    ]);
    await processNotificationQueue();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });
});
