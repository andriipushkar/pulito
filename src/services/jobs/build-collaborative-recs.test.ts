import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockBuildCollaborativeRecommendations } = vi.hoisted(() => ({
  mockBuildCollaborativeRecommendations: vi.fn(),
}));

vi.mock('@/services/recommendation', () => ({
  buildCollaborativeRecommendations: mockBuildCollaborativeRecommendations,
}));

import { runBuildCollaborativeRecs } from './build-collaborative-recs';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runBuildCollaborativeRecs', () => {
  it('should return created count and duration', async () => {
    mockBuildCollaborativeRecommendations.mockResolvedValue(42);

    const result = await runBuildCollaborativeRecs();

    expect(result.created).toBe(42);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(mockBuildCollaborativeRecommendations).toHaveBeenCalledTimes(1);
  });

  it('should return 0 created when no recommendations built', async () => {
    mockBuildCollaborativeRecommendations.mockResolvedValue(0);

    const result = await runBuildCollaborativeRecs();

    expect(result.created).toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should propagate errors from recommendation service', async () => {
    mockBuildCollaborativeRecommendations.mockRejectedValue(new Error('DB error'));

    await expect(runBuildCollaborativeRecs()).rejects.toThrow('DB error');
  });

  it('should measure duration correctly', async () => {
    mockBuildCollaborativeRecommendations.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(5), 50))
    );

    const result = await runBuildCollaborativeRecs();

    expect(result.durationMs).toBeGreaterThanOrEqual(40);
    expect(result.created).toBe(5);
  });
});
