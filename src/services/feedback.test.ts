import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    DATABASE_URL: 'postgres://test',
    JWT_SECRET: 'a]3Kf9$mPz!wQr7vLx2NhBt5YdCjEu8G',
    APP_SECRET: 'b]3Kf9$mPz!wQr7vLx2NhBt5YdCjEu8G',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    NODE_ENV: 'test',
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    feedback: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { FeedbackError, createFeedback, getFeedbackList, updateFeedbackStatus } from './feedback';

const mockPrisma = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FeedbackError', () => {
  it('creates error with message and statusCode', () => {
    const err = new FeedbackError('not found', 404);
    expect(err.message).toBe('not found');
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe('FeedbackError');
  });
});

describe('createFeedback', () => {
  it('creates with status new_feedback', async () => {
    const input = { name: 'John', message: 'Hello', type: 'form' as const };
    const created = { id: 1, ...input, status: 'new_feedback' };
    mockPrisma.feedback.create.mockResolvedValue(created);

    const result = await createFeedback(input);

    expect(result).toEqual(created);
    expect(mockPrisma.feedback.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'John',
        message: 'Hello',
        type: 'form',
        status: 'new_feedback',
      }),
    });
  });

  it('creates callback type with optional fields', async () => {
    const input = { name: 'Jane', message: 'Call me', type: 'callback' as const, phone: '+380501234567', email: 'jane@test.com', subject: 'Order' };
    const created = { id: 2, ...input, status: 'new_feedback' };
    mockPrisma.feedback.create.mockResolvedValue(created);

    const result = await createFeedback(input);

    expect(result).toEqual(created);
    expect(mockPrisma.feedback.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: '+380501234567',
        email: 'jane@test.com',
        subject: 'Order',
        type: 'callback',
      }),
    });
  });
});

describe('getFeedbackList', () => {
  it('returns paginated results with type and status filters', async () => {
    const items = [{ id: 1 }, { id: 2 }];
    mockPrisma.feedback.findMany.mockResolvedValue(items);
    mockPrisma.feedback.count.mockResolvedValue(10);

    const result = await getFeedbackList({ page: 2, limit: 5, type: 'callback', status: 'new_feedback' });

    expect(result).toEqual({ items, total: 10 });
    expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: 'callback', status: 'new_feedback' },
        skip: 5,
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('returns results without filters', async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([]);
    mockPrisma.feedback.count.mockResolvedValue(0);

    const result = await getFeedbackList({ page: 1, limit: 10 });

    expect(result).toEqual({ items: [], total: 0 });
    expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 0, take: 10 }),
    );
  });

  it('applies search filter with OR on name and email', async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([]);
    mockPrisma.feedback.count.mockResolvedValue(0);

    await getFeedbackList({ page: 1, limit: 10, search: 'john' });

    expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: 'john', mode: 'insensitive' } },
            { email: { contains: 'john', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('applies dateFrom filter', async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([]);
    mockPrisma.feedback.count.mockResolvedValue(0);

    await getFeedbackList({ page: 1, limit: 10, dateFrom: '2024-01-01' });

    expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it('applies dateTo filter with end of day', async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([]);
    mockPrisma.feedback.count.mockResolvedValue(0);

    await getFeedbackList({ page: 1, limit: 10, dateTo: '2024-12-31' });

    expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            lte: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it('applies both dateFrom and dateTo filters', async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([]);
    mockPrisma.feedback.count.mockResolvedValue(0);

    await getFeedbackList({ page: 1, limit: 10, dateFrom: '2024-01-01', dateTo: '2024-12-31' });

    expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it('combines all filters together', async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([]);
    mockPrisma.feedback.count.mockResolvedValue(0);

    await getFeedbackList({
      page: 1,
      limit: 10,
      type: 'form',
      status: 'processed',
      search: 'test',
      dateFrom: '2024-01-01',
      dateTo: '2024-06-30',
    });

    const call = mockPrisma.feedback.findMany.mock.calls[0][0];
    expect(call.where.type).toBe('form');
    expect(call.where.status).toBe('processed');
    expect(call.where.OR).toBeDefined();
    expect(call.where.createdAt.gte).toBeInstanceOf(Date);
    expect(call.where.createdAt.lte).toBeInstanceOf(Date);
  });

  it('calculates correct skip for page 3', async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([]);
    mockPrisma.feedback.count.mockResolvedValue(0);

    await getFeedbackList({ page: 3, limit: 20 });

    expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
  });

  it('includes processor relation in findMany', async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([]);
    mockPrisma.feedback.count.mockResolvedValue(0);

    await getFeedbackList({ page: 1, limit: 10 });

    expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { processor: { select: { id: true, fullName: true } } },
      }),
    );
  });
});

describe('updateFeedbackStatus', () => {
  it('throws 404 if feedback not found', async () => {
    mockPrisma.feedback.findUnique.mockResolvedValue(null);

    await expect(updateFeedbackStatus(999, 'processed', 1)).rejects.toThrow(FeedbackError);
    await expect(updateFeedbackStatus(999, 'processed', 1)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('updates status to processed', async () => {
    mockPrisma.feedback.findUnique.mockResolvedValue({ id: 1, status: 'new_feedback' });
    const updated = { id: 1, status: 'processed', processedBy: 5 };
    mockPrisma.feedback.update.mockResolvedValue(updated);

    const result = await updateFeedbackStatus(1, 'processed', 5);

    expect(result).toEqual(updated);
    expect(mockPrisma.feedback.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'processed', processedBy: 5, processedAt: expect.any(Date) },
    });
  });

  it('updates status to rejected', async () => {
    mockPrisma.feedback.findUnique.mockResolvedValue({ id: 2, status: 'new_feedback' });
    const updated = { id: 2, status: 'rejected', processedBy: 3 };
    mockPrisma.feedback.update.mockResolvedValue(updated);

    const result = await updateFeedbackStatus(2, 'rejected', 3);

    expect(result).toEqual(updated);
    expect(mockPrisma.feedback.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { status: 'rejected', processedBy: 3, processedAt: expect.any(Date) },
    });
  });
});
