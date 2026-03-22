import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      create: (...args: unknown[]) => mockCreate(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

import {
  createSubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
} from './subscription';

beforeEach(() => vi.clearAllMocks());

describe('createSubscription', () => {
  it('creates subscription with items and next delivery date', async () => {
    const created = { id: 1, status: 'active', frequency: 'monthly' };
    mockCreate.mockResolvedValue(created);

    const result = await createSubscription(1, {
      frequency: 'monthly',
      deliveryMethod: 'nova_poshta',
      deliveryCity: 'Kyiv',
      deliveryAddress: 'Street 1',
      paymentMethod: 'card',
      items: [{ productId: 10, quantity: 2 }],
    });

    expect(result).toEqual(created);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 1,
          frequency: 'monthly',
          nextDeliveryAt: expect.any(Date),
        }),
      })
    );
  });
});

describe('pauseSubscription', () => {
  it('pauses an active subscription', async () => {
    mockFindFirst.mockResolvedValue({ id: 1, userId: 1, status: 'active' });
    mockUpdate.mockResolvedValue({ id: 1, status: 'paused' });

    const result = await pauseSubscription(1, 1);

    expect(result.status).toBe('paused');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'paused', pausedAt: expect.any(Date) }),
      })
    );
  });

  it('throws when subscription not found', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(pauseSubscription(999, 1)).rejects.toThrow();
  });

  it('throws when subscription is not active', async () => {
    mockFindFirst.mockResolvedValue({ id: 1, userId: 1, status: 'paused' });

    await expect(pauseSubscription(1, 1)).rejects.toThrow();
  });
});

describe('resumeSubscription', () => {
  it('resumes a paused subscription', async () => {
    mockFindFirst.mockResolvedValue({ id: 1, userId: 1, status: 'paused', frequency: 'weekly' });
    mockUpdate.mockResolvedValue({ id: 1, status: 'active' });

    const result = await resumeSubscription(1, 1);

    expect(result.status).toBe('active');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'active',
          pausedAt: null,
          nextDeliveryAt: expect.any(Date),
        }),
      })
    );
  });

  it('throws when subscription is not paused', async () => {
    mockFindFirst.mockResolvedValue({ id: 1, userId: 1, status: 'active' });

    await expect(resumeSubscription(1, 1)).rejects.toThrow();
  });
});

describe('cancelSubscription', () => {
  it('cancels an active subscription', async () => {
    mockFindFirst.mockResolvedValue({ id: 1, userId: 1, status: 'active' });
    mockUpdate.mockResolvedValue({ id: 1, status: 'cancelled' });

    const result = await cancelSubscription(1, 1);

    expect(result.status).toBe('cancelled');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'cancelled', cancelledAt: expect.any(Date) }),
      })
    );
  });

  it('throws when already cancelled', async () => {
    mockFindFirst.mockResolvedValue({ id: 1, userId: 1, status: 'cancelled' });

    await expect(cancelSubscription(1, 1)).rejects.toThrow();
  });

  it('throws when subscription not found', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(cancelSubscription(999, 1)).rejects.toThrow();
  });
});
