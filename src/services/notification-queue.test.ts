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

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userNotification: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
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

  it('returns { sent: 0, skipped: 0 } when no notifications pending', async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await processNotificationQueue();
    expect(result).toEqual({ sent: 0, skipped: 0 });
  });

  it('sends email for notification with email user', async () => {
    mockFindMany.mockResolvedValue([makeNotification()]);
    const result = await processNotificationQueue();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(result.sent).toBeGreaterThanOrEqual(1);
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

  it('increments skipped on email failure', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('SMTP error'));
    mockFindMany.mockResolvedValue([makeNotification()]);
    const result = await processNotificationQueue();
    expect(result.skipped).toBeGreaterThanOrEqual(1);
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

  it('increments skipped on telegram failure', async () => {
    mockSendClientNotification.mockRejectedValueOnce(new Error('TG error'));
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
    const result = await processNotificationQueue();
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });

  it('increments skipped on viber failure', async () => {
    mockSendViberNotification.mockRejectedValueOnce(new Error('Viber error'));
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
    const result = await processNotificationQueue();
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });

  it('handles push notification failure silently', async () => {
    mockSendPushNotification.mockRejectedValueOnce(new Error('Push error'));
    mockFindMany.mockResolvedValue([makeNotification({ user: { id: 1, email: null, telegramChatId: null, viberUserId: null, notificationPrefs: {} } })]);
    const result = await processNotificationQueue();
    // Should not throw, just not count as sent
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
    // The HTML should contain the link
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
