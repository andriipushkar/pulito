import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscriber: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock('./email', () => ({
  sendEmail: vi.fn(),
}));
vi.mock('@/config/env', () => ({
  env: { APP_URL: 'https://test.com' },
}));

import { prisma } from '@/lib/prisma';
import {
  generateUnsubscribeToken,
  SubscriberError,
  subscribe,
  confirmSubscription,
  unsubscribe,
  unsubscribeByEmail,
} from './subscriber';

const subscriberFindUnique = prisma.subscriber.findUnique as ReturnType<typeof vi.fn>;
const subscriberFindFirst = prisma.subscriber.findFirst as ReturnType<typeof vi.fn>;
const subscriberFindMany = prisma.subscriber.findMany as ReturnType<typeof vi.fn>;
const subscriberCreate = prisma.subscriber.create as ReturnType<typeof vi.fn>;
const subscriberUpdate = prisma.subscriber.update as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  subscriberUpdate.mockResolvedValue({});
  subscriberCreate.mockResolvedValue({});
});

describe('generateUnsubscribeToken', () => {
  it('returns consistent hash for same email', () => {
    const token1 = generateUnsubscribeToken('user@example.com');
    const token2 = generateUnsubscribeToken('user@example.com');
    expect(token1).toBe(token2);
    expect(typeof token1).toBe('string');
    expect(token1.length).toBeGreaterThan(0);
  });

  it('is case-insensitive', () => {
    const lower = generateUnsubscribeToken('user@example.com');
    const upper = generateUnsubscribeToken('USER@EXAMPLE.COM');
    expect(lower).toBe(upper);
  });
});

describe('subscribe', () => {
  it('creates new subscriber with pending status', async () => {
    subscriberFindUnique.mockResolvedValue(null);

    const result = await subscribe('new@example.com', 'footer');

    expect(subscriberCreate).toHaveBeenCalledWith({
      data: {
        email: 'new@example.com',
        confirmationToken: expect.any(String),
        source: 'footer',
        status: 'pending_sub',
      },
    });
    expect(result.message).toBeDefined();
  });

  it('re-sends confirmation for pending subscriber', async () => {
    subscriberFindUnique.mockResolvedValue({
      id: 1,
      email: 'pending@example.com',
      status: 'pending_sub',
    });

    const result = await subscribe('pending@example.com');

    expect(subscriberUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { confirmationToken: expect.any(String) },
    });
    expect(result.message).toBeDefined();
  });

  it('throws 409 for already confirmed subscriber', async () => {
    subscriberFindUnique.mockResolvedValue({
      id: 2,
      email: 'confirmed@example.com',
      status: 'confirmed',
    });

    await expect(subscribe('confirmed@example.com')).rejects.toThrow(SubscriberError);
    await expect(subscribe('confirmed@example.com')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('re-subscribes unsubscribed user', async () => {
    subscriberFindUnique.mockResolvedValue({
      id: 3,
      email: 'unsub@example.com',
      status: 'unsubscribed',
    });

    const result = await subscribe('unsub@example.com');

    expect(subscriberUpdate).toHaveBeenCalledWith({
      where: { id: 3 },
      data: {
        status: 'pending_sub',
        confirmationToken: expect.any(String),
        unsubscribedAt: null,
      },
    });
    expect(result.message).toBeDefined();
  });
});

describe('confirmSubscription', () => {
  it('confirms valid token', async () => {
    subscriberFindFirst.mockResolvedValue({
      id: 5,
      email: 'user@example.com',
      confirmationToken: 'valid-token',
      status: 'pending_sub',
    });

    const result = await confirmSubscription('valid-token');

    expect(subscriberUpdate).toHaveBeenCalledWith({
      where: { id: 5 },
      data: {
        status: 'confirmed',
        confirmationToken: null,
        confirmedAt: expect.any(Date),
      },
    });
    expect(result.message).toBeDefined();
  });

  it('throws 400 for invalid token', async () => {
    subscriberFindFirst.mockResolvedValue(null);

    await expect(confirmSubscription('bad-token')).rejects.toThrow(SubscriberError);
    await expect(confirmSubscription('bad-token')).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('unsubscribe', () => {
  it('unsubscribes matching subscriber', async () => {
    const email = 'user@example.com';
    const token = generateUnsubscribeToken(email);

    subscriberFindMany.mockResolvedValue([
      { id: 10, email, status: 'confirmed' },
    ]);

    const result = await unsubscribe(token);

    expect(subscriberUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { status: 'unsubscribed', unsubscribedAt: expect.any(Date) },
    });
    expect(result.message).toBeDefined();
  });

  it('throws 404 for no match', async () => {
    subscriberFindMany.mockResolvedValue([]);

    await expect(unsubscribe('nonexistent-token')).rejects.toThrow(SubscriberError);
    await expect(unsubscribe('nonexistent-token')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('unsubscribeByEmail', () => {
  it('unsubscribes by email', async () => {
    subscriberFindUnique.mockResolvedValue({
      id: 20,
      email: 'user@example.com',
      status: 'confirmed',
    });

    const result = await unsubscribeByEmail('user@example.com');

    expect(subscriberUpdate).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { status: 'unsubscribed', unsubscribedAt: expect.any(Date) },
    });
    expect(result.message).toBeDefined();
  });

  it('throws 404 for not found', async () => {
    subscriberFindUnique.mockResolvedValue(null);

    await expect(unsubscribeByEmail('missing@example.com')).rejects.toThrow(SubscriberError);
    await expect(unsubscribeByEmail('missing@example.com')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('throws 404 for already unsubscribed user', async () => {
    subscriberFindUnique.mockResolvedValue({
      id: 30,
      email: 'already-unsub@example.com',
      status: 'unsubscribed',
    });

    await expect(unsubscribeByEmail('already-unsub@example.com')).rejects.toThrow(SubscriberError);
    await expect(unsubscribeByEmail('already-unsub@example.com')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('SubscriberError', () => {
  it('should create error with correct properties', () => {
    const err = new SubscriberError('test', 400);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('test');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('SubscriberError');
  });
});

describe('generateUnsubscribeToken - APP_URL fallback (line 11)', () => {
  it('should use fallback secret when APP_URL is empty', async () => {
    vi.resetModules();
    vi.mock('@/lib/prisma', () => ({
      prisma: {
        subscriber: {
          findUnique: vi.fn(),
          findFirst: vi.fn(),
          findMany: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
        },
      },
    }));
    vi.mock('./email', () => ({ sendEmail: vi.fn() }));
    vi.mock('@/config/env', () => ({
      env: { APP_URL: '' },
    }));

    const mod = await import('./subscriber');
    const token = mod.generateUnsubscribeToken('test@example.com');

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });
});

describe('subscribe - pending_sub user with source', () => {
  it('creates new subscriber without source', async () => {
    subscriberFindUnique.mockResolvedValue(null);
    const result = await subscribe('nosrc@example.com');
    expect(subscriberCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ source: undefined }),
    });
    expect(result.message).toBeDefined();
  });
});
