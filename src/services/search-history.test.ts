import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    searchHistory: { create: vi.fn(), findMany: vi.fn(), count: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { saveSearch, getSearchHistory, deleteSearchEntry, clearSearchHistory, trackClick, getRecentUniqueQueries } from './search-history';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('saveSearch', () => {
  it('truncates query to 255 chars', async () => {
    const longQuery = 'a'.repeat(300);
    vi.mocked(prisma.searchHistory.create).mockResolvedValue({} as any);

    await saveSearch(1, longQuery, 5);

    expect(prisma.searchHistory.create).toHaveBeenCalledWith({
      data: {
        userId: 1,
        query: 'a'.repeat(255),
        resultsCount: 5,
      },
    });
  });
});

describe('getSearchHistory', () => {
  it('returns paginated results', async () => {
    const items = [{ id: 1, query: 'test' }];
    vi.mocked(prisma.searchHistory.findMany).mockResolvedValue(items as any);
    vi.mocked(prisma.searchHistory.count).mockResolvedValue(20);

    const result = await getSearchHistory(1, 2, 10);

    expect(result).toEqual({ items, total: 20 });
    expect(prisma.searchHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1 },
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(prisma.searchHistory.count).toHaveBeenCalledWith({ where: { userId: 1 } });
  });
});

describe('deleteSearchEntry', () => {
  it('filters by id and userId', async () => {
    vi.mocked(prisma.searchHistory.deleteMany).mockResolvedValue({ count: 1 });

    await deleteSearchEntry(5, 1);

    expect(prisma.searchHistory.deleteMany).toHaveBeenCalledWith({
      where: { id: 5, userId: 1 },
    });
  });
});

describe('clearSearchHistory', () => {
  it('deletes all for user', async () => {
    vi.mocked(prisma.searchHistory.deleteMany).mockResolvedValue({ count: 10 });

    await clearSearchHistory(1);

    expect(prisma.searchHistory.deleteMany).toHaveBeenCalledWith({
      where: { userId: 1 },
    });
  });
});

describe('trackClick', () => {
  it('updates clickedProductId', async () => {
    vi.mocked(prisma.searchHistory.updateMany).mockResolvedValue({ count: 1 });

    await trackClick(5, 1, 42);

    expect(prisma.searchHistory.updateMany).toHaveBeenCalledWith({
      where: { id: 5, userId: 1 },
      data: { clickedProductId: 42 },
    });
  });
});

describe('getRecentUniqueQueries', () => {
  it('deduplicates by lowercase', async () => {
    const now = new Date();
    vi.mocked(prisma.searchHistory.findMany).mockResolvedValue([
      { id: 1, query: 'Hello', createdAt: now },
      { id: 2, query: 'hello', createdAt: now },
      { id: 3, query: 'World', createdAt: now },
      { id: 4, query: 'HELLO', createdAt: now },
    ] as any);

    const result = await getRecentUniqueQueries(1, 5);

    expect(result).toHaveLength(2);
    expect(result[0].query).toBe('Hello');
    expect(result[1].query).toBe('World');
    expect(prisma.searchHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1 },
        orderBy: { createdAt: 'desc' },
        take: 15, // limit * 3
      }),
    );
  });
});
