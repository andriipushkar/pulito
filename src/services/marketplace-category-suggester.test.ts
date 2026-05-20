import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    category: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { suggestLocalCategory } from './marketplace-category-suggester';

beforeEach(() => vi.clearAllMocks());

describe('suggestLocalCategory', () => {
  it('returns empty when no tokens', async () => {
    mockPrisma.category.findMany.mockResolvedValue([]);
    const r = await suggestLocalCategory('и для на');
    expect(r).toEqual([]);
  });

  it('matches by name token overlap', async () => {
    mockPrisma.category.findMany.mockResolvedValue([
      { id: 1, name: 'Побутова хімія', slug: 'pobutova-himiya' },
      { id: 2, name: 'Електроінструменти', slug: 'elektroinstrumenty' },
      { id: 3, name: 'Дитячі товари', slug: 'dytyachi-tovary' },
    ]);
    const r = await suggestLocalCategory('Пральний порошок Ariel побутова');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].categoryName).toBe('Побутова хімія');
  });

  it('ranks closer matches higher', async () => {
    mockPrisma.category.findMany.mockResolvedValue([
      { id: 1, name: 'Прибирання', slug: 'prybyrannya' },
      { id: 2, name: 'Прання та чистка одягу', slug: 'prannya-chystka-odyahu' },
    ]);
    const r = await suggestLocalCategory('Прання порошок одягу');
    expect(r[0].categoryId).toBe(2);
  });

  it('limits results', async () => {
    mockPrisma.category.findMany.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        name: `тест категорія ${i}`,
        slug: `test${i}`,
      })),
    );
    const r = await suggestLocalCategory('тест категорія', 3);
    expect(r.length).toBeLessThanOrEqual(3);
  });
});
