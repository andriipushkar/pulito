import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    siteSetting: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { getHomepageBlocks } from './homepage';

const mockPrisma = prisma as unknown as MockPrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getHomepageBlocks', () => {
  it('should return saved blocks when setting exists', async () => {
    const savedBlocks = [
      { key: 'categories', label: 'Каталог категорій', enabled: true },
      { key: 'banner_slider', label: 'Банер-слайдер', enabled: false },
    ];

    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      id: 1,
      key: 'homepage_blocks',
      value: JSON.stringify(savedBlocks),
      updatedBy: null,
      updatedAt: new Date(),
    } as never);

    const result = await getHomepageBlocks();

    expect(mockPrisma.siteSetting.findUnique).toHaveBeenCalledWith({
      where: { key: 'homepage_blocks' },
    });
    expect(result).toEqual(savedBlocks);
    expect(result[0].key).toBe('categories');
    expect(result[1].enabled).toBe(false);
  });

  it('should return default blocks when no setting exists', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);

    const result = await getHomepageBlocks();

    expect(result).toHaveLength(8);
    expect(result[0].key).toBe('banner_slider');
    expect(result.every((b) => b.enabled)).toBe(true);
  });

  it('should return default blocks on database error', async () => {
    mockPrisma.siteSetting.findUnique.mockRejectedValue(new Error('Connection refused'));

    const result = await getHomepageBlocks();

    expect(result).toHaveLength(8);
    expect(result[0].key).toBe('banner_slider');
  });

  it('should return all default block keys in correct order', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);

    const result = await getHomepageBlocks();

    const keys = result.map((b) => b.key);
    expect(keys).toEqual([
      'banner_slider',
      'categories',
      'promo_products',
      'new_products',
      'popular_products',
      'recently_viewed',
      'brands',
      'seo_text',
    ]);
  });

  it('should filter out legacy usp block from stored settings', async () => {
    const withLegacy = [
      { key: 'banner_slider', label: 'Банер-слайдер', enabled: true },
      { key: 'usp', label: 'Блок переваг (USP)', enabled: true },
      { key: 'categories', label: 'Каталог категорій', enabled: true },
    ];

    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      id: 1,
      key: 'homepage_blocks',
      value: JSON.stringify(withLegacy),
      updatedBy: null,
      updatedAt: new Date(),
    } as never);

    const result = await getHomepageBlocks();

    expect(result.map((b) => b.key)).toEqual(['banner_slider', 'categories']);
  });

  it('should preserve custom block order from saved settings', async () => {
    const customOrder = [
      { key: 'seo_text', label: 'SEO-текстовий блок', enabled: true },
      { key: 'brands', label: 'Бренди / Виробники', enabled: true },
      { key: 'banner_slider', label: 'Банер-слайдер', enabled: true },
    ];

    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      id: 1,
      key: 'homepage_blocks',
      value: JSON.stringify(customOrder),
      updatedBy: null,
      updatedAt: new Date(),
    } as never);

    const result = await getHomepageBlocks();

    expect(result[0].key).toBe('seo_text');
    expect(result[1].key).toBe('brands');
    expect(result[2].key).toBe('banner_slider');
  });
});
