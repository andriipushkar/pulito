import { describe, it, expect, vi, beforeEach } from 'vitest';

// No VAPID keys set - testing early return paths

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
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
import { sendPushNotification, sendPushToAll } from './push';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('push - no VAPID keys', () => {
  it('sendPushToAll should return early when VAPID keys are empty (line 101)', async () => {
    await sendPushToAll({ title: 'Test', body: 'Body' });

    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
  });

  it('sendPushNotification should return early when VAPID keys are empty (line 55)', async () => {
    await sendPushNotification(1, { title: 'Test', body: 'Body' });

    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
  });
});
