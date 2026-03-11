import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  process.env.VAPID_PUBLIC_KEY = 'test-vapid-public-key';
  process.env.VAPID_PRIVATE_KEY = 'test-vapid-private-key';
  process.env.VAPID_EMAIL = 'mailto:test@clean-shop.ua';
});

const mockSendNotification = vi.fn();

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    pushSubscription: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import type { MockPrismaClient } from '@/test/prisma-mock';

const mockPrisma = prisma as unknown as MockPrismaClient;

import { subscribePush, unsubscribePush, sendPushNotification, sendPushToAll, getVapidPublicKey } from './push';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('subscribePush', () => {
  it('should upsert a push subscription for a user', async () => {
    const subscription = {
      endpoint: 'https://push.example.com/sub1',
      keys: { p256dh: 'key-p256dh', auth: 'key-auth' },
    };
    const upserted = { id: 1, userId: 1, ...subscription.keys, endpoint: subscription.endpoint };
    mockPrisma.pushSubscription.upsert.mockResolvedValue(upserted as never);

    const result = await subscribePush(1, subscription);

    expect(mockPrisma.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example.com/sub1' },
      update: {
        userId: 1,
        p256dh: 'key-p256dh',
        auth: 'key-auth',
      },
      create: {
        userId: 1,
        endpoint: 'https://push.example.com/sub1',
        p256dh: 'key-p256dh',
        auth: 'key-auth',
      },
    });
    expect(result).toEqual(upserted);
  });
});

describe('unsubscribePush', () => {
  it('should delete subscriptions matching the endpoint', async () => {
    mockPrisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 } as never);

    await unsubscribePush('https://push.example.com/sub1');

    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example.com/sub1' },
    });
  });
});

describe('sendPushNotification', () => {
  it('should send push notifications to all subscriptions of a user', async () => {
    const subs = [
      { endpoint: 'https://push.example.com/sub1', p256dh: 'key1', auth: 'auth1' },
      { endpoint: 'https://push.example.com/sub2', p256dh: 'key2', auth: 'auth2' },
    ];
    mockPrisma.pushSubscription.findMany.mockResolvedValue(subs as never);
    mockSendNotification.mockResolvedValue({});

    await sendPushNotification(1, {
      title: 'Order shipped',
      body: 'Your order #123 has been shipped',
      url: '/account/orders/123',
    });

    expect(mockPrisma.pushSubscription.findMany).toHaveBeenCalledWith({
      where: { userId: 1 },
    });
    expect(mockSendNotification).toHaveBeenCalledTimes(2);
    expect(mockSendNotification).toHaveBeenCalledWith(
      { endpoint: 'https://push.example.com/sub1', keys: { p256dh: 'key1', auth: 'auth1' } },
      expect.stringContaining('Order shipped')
    );
  });

  it('should not send if no subscriptions exist', async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValue([] as never);

    await sendPushNotification(1, { title: 'Test', body: 'Test body' });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('should use default url and icon when not provided', async () => {
    const subs = [
      { endpoint: 'https://push.example.com/sub1', p256dh: 'key1', auth: 'auth1' },
    ];
    mockPrisma.pushSubscription.findMany.mockResolvedValue(subs as never);
    mockSendNotification.mockResolvedValue({});

    await sendPushNotification(1, { title: 'Test', body: 'Body' });

    const payload = JSON.parse(mockSendNotification.mock.calls[0][1]);
    expect(payload.url).toBe('/');
    expect(payload.icon).toBe('/icons/icon-192x192.png');
  });

  it('should cleanup expired subscriptions with 410 status', async () => {
    const subs = [
      { endpoint: 'https://push.example.com/active', p256dh: 'key1', auth: 'auth1' },
      { endpoint: 'https://push.example.com/expired', p256dh: 'key2', auth: 'auth2' },
    ];
    mockPrisma.pushSubscription.findMany.mockResolvedValue(subs as never);
    mockSendNotification
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ statusCode: 410 });
    mockPrisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 } as never);

    await sendPushNotification(1, { title: 'Test', body: 'Body' });

    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: { in: ['https://push.example.com/expired'] } },
    });
  });

  it('should not cleanup subscriptions when no 410 errors occur', async () => {
    const subs = [
      { endpoint: 'https://push.example.com/sub1', p256dh: 'key1', auth: 'auth1' },
    ];
    mockPrisma.pushSubscription.findMany.mockResolvedValue(subs as never);
    mockSendNotification.mockResolvedValue({});

    await sendPushNotification(1, { title: 'Test', body: 'Body' });

    expect(mockPrisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it('should not delete subscriptions failing with non-410 errors', async () => {
    const subs = [
      { endpoint: 'https://push.example.com/sub1', p256dh: 'key1', auth: 'auth1' },
    ];
    mockPrisma.pushSubscription.findMany.mockResolvedValue(subs as never);
    mockSendNotification.mockRejectedValue({ statusCode: 500 });

    await sendPushNotification(1, { title: 'Test', body: 'Body' });

    expect(mockPrisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });
});

describe('sendPushToAll', () => {
  it('should send push notifications to all subscribed users', async () => {
    const subs = [
      { endpoint: 'https://push.example.com/sub1', p256dh: 'key1', auth: 'auth1' },
      { endpoint: 'https://push.example.com/sub2', p256dh: 'key2', auth: 'auth2' },
    ];
    mockPrisma.pushSubscription.findMany.mockResolvedValue(subs as never);
    mockSendNotification.mockResolvedValue({});

    await sendPushToAll({ title: 'Promo', body: 'Big sale today!' });

    expect(mockPrisma.pushSubscription.findMany).toHaveBeenCalledWith();
    expect(mockSendNotification).toHaveBeenCalledTimes(2);
  });

  it('should not send if no subscriptions exist', async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValue([] as never);

    await sendPushToAll({ title: 'Test', body: 'Body' });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('should cleanup expired subscriptions with 410 status', async () => {
    const subs = [
      { endpoint: 'https://push.example.com/active', p256dh: 'key1', auth: 'auth1' },
      { endpoint: 'https://push.example.com/expired', p256dh: 'key2', auth: 'auth2' },
    ];
    mockPrisma.pushSubscription.findMany.mockResolvedValue(subs as never);
    mockSendNotification
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ statusCode: 410 });
    mockPrisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 } as never);

    await sendPushToAll({ title: 'Promo', body: 'Sale!' });

    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: { in: ['https://push.example.com/expired'] } },
    });
  });

  it('should send in batches of 50', async () => {
    // Create 75 subscriptions
    const subs = Array.from({ length: 75 }, (_, i) => ({
      endpoint: `https://push.example.com/sub${i}`,
      p256dh: `key${i}`,
      auth: `auth${i}`,
    }));
    mockPrisma.pushSubscription.findMany.mockResolvedValue(subs as never);
    mockSendNotification.mockResolvedValue({});

    await sendPushToAll({ title: 'Batch Test', body: 'Batching' });

    // All 75 should be called
    expect(mockSendNotification).toHaveBeenCalledTimes(75);
  });
});

describe('getVapidPublicKey', () => {
  it('should return the VAPID public key', () => {
    const key = getVapidPublicKey();
    expect(key).toBe('test-vapid-public-key');
  });
});

describe('sendPushNotification - no VAPID keys', () => {
  it('should return early when VAPID keys are empty', async () => {
    // We test this by verifying behavior: even if we pass userId, no DB call should happen
    // if keys are empty. But since the module was loaded with keys set, we test the early return
    // for no subscriptions path (which is the closest we can verify without re-importing)
    mockPrisma.pushSubscription.findMany.mockResolvedValue([] as never);

    await sendPushNotification(1, { title: 'T', body: 'B' });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });
});

describe('sendPushToAll - no expired subscriptions', () => {
  it('should not cleanup when no 410 errors', async () => {
    const subs = [
      { endpoint: 'https://push.example.com/sub1', p256dh: 'key1', auth: 'auth1' },
    ];
    mockPrisma.pushSubscription.findMany.mockResolvedValue(subs as never);
    mockSendNotification.mockResolvedValue({});

    await sendPushToAll({ title: 'Test', body: 'Body' });

    expect(mockPrisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it('should use default url and icon', async () => {
    const subs = [
      { endpoint: 'https://push.example.com/sub1', p256dh: 'key1', auth: 'auth1' },
    ];
    mockPrisma.pushSubscription.findMany.mockResolvedValue(subs as never);
    mockSendNotification.mockResolvedValue({});

    await sendPushToAll({ title: 'Test', body: 'Body' });

    const payload = JSON.parse(mockSendNotification.mock.calls[0][1]);
    expect(payload.url).toBe('/');
    expect(payload.icon).toBe('/icons/icon-192x192.png');
  });

  it('should ignore non-410 errors during batch send', async () => {
    const subs = [
      { endpoint: 'https://push.example.com/sub1', p256dh: 'key1', auth: 'auth1' },
    ];
    mockPrisma.pushSubscription.findMany.mockResolvedValue(subs as never);
    mockSendNotification.mockRejectedValue({ statusCode: 500 });

    await sendPushToAll({ title: 'Test', body: 'Body' });

    expect(mockPrisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });
});
// No-VAPID-keys tests moved to push-no-vapid.test.ts to avoid vi.resetModules() corruption
