import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    feedback: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { FeedbackError, createFeedback, getFeedbackList, updateFeedbackStatus } from './feedback';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createFeedback', () => {
  it('creates with status new_feedback', async () => {
    const input = { name: 'John', message: 'Hello', type: 'form' as const };
    const created = { id: 1, ...input, status: 'new_feedback' };
    vi.mocked(prisma.feedback.create).mockResolvedValue(created as any);

    const result = await createFeedback(input);

    expect(result).toEqual(created);
    expect(prisma.feedback.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'John',
        message: 'Hello',
        type: 'form',
        status: 'new_feedback',
      }),
    });
  });
});

describe('getFeedbackList', () => {
  it('returns paginated results with filters', async () => {
    const items = [{ id: 1 }, { id: 2 }];
    vi.mocked(prisma.feedback.findMany).mockResolvedValue(items as any);
    vi.mocked(prisma.feedback.count).mockResolvedValue(10);

    const result = await getFeedbackList({ page: 2, limit: 5, type: 'callback', status: 'new_feedback' });

    expect(result).toEqual({ items, total: 10 });
    expect(prisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: 'callback', status: 'new_feedback' },
        skip: 5,
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(prisma.feedback.count).toHaveBeenCalledWith({
      where: { type: 'callback', status: 'new_feedback' },
    });
  });

  it('returns results without type/status filters', async () => {
    vi.mocked(prisma.feedback.findMany).mockResolvedValue([]);
    vi.mocked(prisma.feedback.count).mockResolvedValue(0);

    const result = await getFeedbackList({ page: 1, limit: 10 });

    expect(result).toEqual({ items: [], total: 0 });
    expect(prisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        skip: 0,
        take: 10,
      }),
    );
  });
});

describe('updateFeedbackStatus', () => {
  it('throws 404 if not found', async () => {
    vi.mocked(prisma.feedback.findUnique).mockResolvedValue(null);

    await expect(updateFeedbackStatus(999, 'processed', 1)).rejects.toThrow(FeedbackError);
    await expect(updateFeedbackStatus(999, 'processed', 1)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('updates status', async () => {
    vi.mocked(prisma.feedback.findUnique).mockResolvedValue({ id: 1, status: 'new_feedback' } as any);
    const updated = { id: 1, status: 'processed', processedBy: 5 };
    vi.mocked(prisma.feedback.update).mockResolvedValue(updated as any);

    const result = await updateFeedbackStatus(1, 'processed', 5);

    expect(result).toEqual(updated);
    expect(prisma.feedback.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'processed', processedBy: 5, processedAt: expect.any(Date) },
    });
  });
});
