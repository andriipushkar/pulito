import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAggregateDailyMetrics } = vi.hoisted(() => ({
  mockAggregateDailyMetrics: vi.fn(),
}));

vi.mock('@/services/performance', () => ({
  aggregateDailyMetrics: mockAggregateDailyMetrics,
}));

import { performanceAggregateJob } from './performance-aggregate';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('performanceAggregateJob', () => {
  it('should call aggregateDailyMetrics with yesterday date string', async () => {
    mockAggregateDailyMetrics.mockResolvedValue(undefined);

    const result = await performanceAggregateJob();

    expect(mockAggregateDailyMetrics).toHaveBeenCalledTimes(1);
    const dateStr = mockAggregateDailyMetrics.mock.calls[0][0];
    // Should be YYYY-MM-DD format
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Verify it's yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(dateStr).toBe(yesterday.toISOString().slice(0, 10));

    expect(result).toEqual({ date: dateStr, status: 'completed' });
  });

  it('should return date and completed status', async () => {
    mockAggregateDailyMetrics.mockResolvedValue(undefined);
    const result = await performanceAggregateJob();
    expect(result.status).toBe('completed');
    expect(typeof result.date).toBe('string');
  });

  it('should propagate errors from aggregateDailyMetrics', async () => {
    mockAggregateDailyMetrics.mockRejectedValue(new Error('Redis down'));
    await expect(performanceAggregateJob()).rejects.toThrow('Redis down');
  });
});
