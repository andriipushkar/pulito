import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPublishNow } = vi.hoisted(() => ({
  mockPublishNow: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    publication: { findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/services/publication', () => ({
  publishNow: mockPublishNow,
}));

import { prisma } from '@/lib/prisma';
import { publishScheduledPublications } from './publish-scheduled';

const mockPrisma = prisma as unknown as {
  publication: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('publishScheduledPublications', () => {
  it('should return zeros when no pending publications', async () => {
    mockPrisma.publication.findMany.mockResolvedValue([]);
    const result = await publishScheduledPublications();
    expect(result).toEqual({ published: 0, failed: 0, retried: 0 });
  });

  it('should publish a scheduled publication successfully', async () => {
    mockPrisma.publication.findMany.mockResolvedValue([
      { id: 1, title: 'Post 1', status: 'scheduled', retryCount: 0 },
    ]);
    mockPublishNow.mockResolvedValue(undefined);

    const result = await publishScheduledPublications();

    expect(result).toEqual({ published: 1, failed: 0, retried: 0 });
    expect(mockPublishNow).toHaveBeenCalledWith(1);
    // Should NOT reset status for non-retry
    expect(mockPrisma.publication.update).not.toHaveBeenCalled();
  });

  it('should retry a failed publication and reset status', async () => {
    mockPrisma.publication.findMany.mockResolvedValue([
      { id: 2, title: 'Post 2', status: 'failed', retryCount: 1 },
    ]);
    mockPublishNow.mockResolvedValue(undefined);
    mockPrisma.publication.update.mockResolvedValue({});

    const result = await publishScheduledPublications();

    expect(result).toEqual({ published: 1, failed: 0, retried: 1 });
    // Should reset status to 'scheduled' before retry
    expect(mockPrisma.publication.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { status: 'scheduled' },
    });
    expect(mockPublishNow).toHaveBeenCalledWith(2);
  });

  it('should handle publish failure and update with error', async () => {
    mockPrisma.publication.findMany.mockResolvedValue([
      { id: 1, title: 'Post 1', status: 'scheduled', retryCount: 0 },
    ]);
    mockPublishNow.mockRejectedValue(new Error('API timeout'));
    mockPrisma.publication.update.mockResolvedValue({});

    const result = await publishScheduledPublications();

    expect(result).toEqual({ published: 0, failed: 1, retried: 0 });
    expect(mockPrisma.publication.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: 'failed',
        errorMessage: '[Спроба 1/3] API timeout',
        retryCount: 1,
      },
    });
  });

  it('should handle publish failure for retry and increment retryCount', async () => {
    mockPrisma.publication.findMany.mockResolvedValue([
      { id: 2, title: 'Post 2', status: 'failed', retryCount: 1 },
    ]);
    mockPublishNow.mockRejectedValue(new Error('Still failing'));
    mockPrisma.publication.update.mockResolvedValue({});

    const result = await publishScheduledPublications();

    expect(result).toEqual({ published: 0, failed: 1, retried: 0 });
    // First update: reset status to scheduled
    expect(mockPrisma.publication.update).toHaveBeenNthCalledWith(1, {
      where: { id: 2 },
      data: { status: 'scheduled' },
    });
    // Second update: record failure with incremented retry count
    expect(mockPrisma.publication.update).toHaveBeenNthCalledWith(2, {
      where: { id: 2 },
      data: {
        status: 'failed',
        errorMessage: '[Спроба 2/3] Still failing',
        retryCount: 2,
      },
    });
  });

  it('should set status to failed when retryCount reaches MAX_RETRY_COUNT', async () => {
    mockPrisma.publication.findMany.mockResolvedValue([
      { id: 3, title: 'Post 3', status: 'failed', retryCount: 2 },
    ]);
    mockPublishNow.mockRejectedValue(new Error('Final fail'));
    mockPrisma.publication.update.mockResolvedValue({});

    const result = await publishScheduledPublications();

    expect(result).toEqual({ published: 0, failed: 1, retried: 0 });
    // The error update
    const errorUpdateCall = mockPrisma.publication.update.mock.calls.find(
      (c: unknown[]) => (c[0] as { data: { retryCount?: number } }).data.retryCount === 3
    );
    expect(errorUpdateCall).toBeDefined();
    expect((errorUpdateCall![0] as { data: { status: string } }).data.status).toBe('failed');
    expect((errorUpdateCall![0] as { data: { errorMessage: string } }).data.errorMessage).toBe('[Спроба 3/3] Final fail');
  });

  it('should handle non-Error exception in publishNow', async () => {
    mockPrisma.publication.findMany.mockResolvedValue([
      { id: 1, title: 'Post 1', status: 'scheduled', retryCount: 0 },
    ]);
    mockPublishNow.mockRejectedValue('string error');
    mockPrisma.publication.update.mockResolvedValue({});

    const result = await publishScheduledPublications();

    expect(result).toEqual({ published: 0, failed: 1, retried: 0 });
    expect(mockPrisma.publication.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: 'failed',
        errorMessage: '[Спроба 1/3] Unknown error',
        retryCount: 1,
      },
    });
  });

  it('should handle null retryCount', async () => {
    mockPrisma.publication.findMany.mockResolvedValue([
      { id: 1, title: 'Post 1', status: 'scheduled', retryCount: null },
    ]);
    mockPublishNow.mockRejectedValue(new Error('fail'));
    mockPrisma.publication.update.mockResolvedValue({});

    const result = await publishScheduledPublications();
    expect(result).toEqual({ published: 0, failed: 1, retried: 0 });
    expect(mockPrisma.publication.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: 'failed',
        errorMessage: '[Спроба 1/3] fail',
        retryCount: 1,
      },
    });
  });

  it('should process mixed scheduled and failed publications', async () => {
    mockPrisma.publication.findMany.mockResolvedValue([
      { id: 1, title: 'Post 1', status: 'scheduled', retryCount: 0 },
      { id: 2, title: 'Post 2', status: 'failed', retryCount: 1 },
      { id: 3, title: 'Post 3', status: 'scheduled', retryCount: 0 },
    ]);
    mockPublishNow
      .mockResolvedValueOnce(undefined) // Post 1 succeeds
      .mockResolvedValueOnce(undefined) // Post 2 retry succeeds
      .mockRejectedValueOnce(new Error('fail')); // Post 3 fails
    mockPrisma.publication.update.mockResolvedValue({});

    const result = await publishScheduledPublications();

    expect(result).toEqual({ published: 2, failed: 1, retried: 1 });
  });
});
