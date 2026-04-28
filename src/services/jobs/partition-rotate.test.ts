import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRawUnsafe: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

import { prisma } from '@/lib/prisma';
import { rotateClientEventsPartitions } from './partition-rotate';

const mockExec = vi.mocked(prisma.$executeRawUnsafe);
const mockQuery = vi.mocked(prisma.$queryRawUnsafe);

beforeEach(() => {
  vi.clearAllMocks();
  mockExec.mockResolvedValue(1 as never);
  mockQuery.mockResolvedValue([{ drop_old_client_events_partitions: 0 }] as never);
});

describe('rotateClientEventsPartitions', () => {
  it('creates partitions for current and next N months', async () => {
    const result = await rotateClientEventsPartitions(2);
    expect(result.partitionsCreated.length).toBe(3); // 0, +1, +2 months
    // Each entry should be the first day of a month
    for (const date of result.partitionsCreated) {
      expect(date).toMatch(/^\d{4}-\d{2}-01$/);
    }
  });

  it('passes retention months to drop function', async () => {
    mockQuery.mockResolvedValueOnce([{ drop_old_client_events_partitions: 4 }] as never);

    const result = await rotateClientEventsPartitions(0, 6);

    expect(result.partitionsDropped).toBe(4);
    expect(result.retentionMonths).toBe(6);
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), 6);
  });

  it('continues even if a single ensure call fails', async () => {
    mockExec.mockRejectedValueOnce(new Error('boom'));

    const result = await rotateClientEventsPartitions(1);

    // Failed first month, succeeded for the next
    expect(result.partitionsCreated.length).toBe(1);
  });

  it('reports zero dropped on query failure', async () => {
    mockQuery.mockRejectedValueOnce(new Error('boom'));

    const result = await rotateClientEventsPartitions(0);

    expect(result.partitionsDropped).toBe(0);
  });
});
