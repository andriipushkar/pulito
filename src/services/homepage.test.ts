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

const ALL_DEFAULT_KEYS = [
  'banner_slider',
  'local_lviv',
  'categories',
  'promo_products',
  'new_products',
  'popular_products',
  'recently_viewed',
  'brands',
  'seo_text',
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getHomepageBlocks', () => {
  it('should return saved blocks merged with newer default blocks', async () => {
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
    // Saved entries keep their state…
    const banner = result.find((b) => b.key === 'banner_slider');
    expect(banner?.enabled).toBe(false);
    // …and defaults the stored list predates are merged in (e.g. local_lviv).
    expect(result.map((b) => b.key).sort()).toEqual([...ALL_DEFAULT_KEYS].sort());
  });

  it('should return default blocks when no setting exists', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);

    const result = await getHomepageBlocks();

    expect(result).toHaveLength(ALL_DEFAULT_KEYS.length);
    expect(result[0].key).toBe('banner_slider');
    expect(result.every((b) => b.enabled)).toBe(true);
  });

  it('should return default blocks on database error', async () => {
    mockPrisma.siteSetting.findUnique.mockRejectedValue(new Error('Connection refused'));

    const result = await getHomepageBlocks();

    expect(result).toHaveLength(ALL_DEFAULT_KEYS.length);
    expect(result[0].key).toBe('banner_slider');
  });

  it('should return all default block keys in correct order', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);

    const result = await getHomepageBlocks();

    expect(result.map((b) => b.key)).toEqual(ALL_DEFAULT_KEYS);
  });

  it('should read the versioned-doc shape the admin route persists', async () => {
    // Regression: admin PUT writes `{ version, blocks }`. The old parser only
    // handled a bare array, so it threw → defaults → disabled blocks (e.g.
    // local_lviv) reappeared on the storefront.
    const doc = {
      version: 1,
      blocks: [
        { key: 'banner_slider', label: 'Банер-слайдер', enabled: true },
        { key: 'local_lviv', label: 'Локальні переваги (Львів)', enabled: false },
        { key: 'categories', label: 'Каталог категорій', enabled: true },
        { key: 'promo_products', label: 'Акційні товари', enabled: true },
        { key: 'new_products', label: 'Новинки', enabled: true },
        { key: 'popular_products', label: 'Хіти продажів', enabled: true },
        { key: 'recently_viewed', label: 'Нещодавно переглянуті', enabled: true },
        { key: 'brands', label: 'Бренди / Торгові марки', enabled: true },
        { key: 'seo_text', label: 'SEO-текстовий блок', enabled: true },
      ],
    };

    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      id: 1,
      key: 'homepage_blocks',
      value: JSON.stringify(doc),
      updatedBy: null,
      updatedAt: new Date(),
    } as never);

    const result = await getHomepageBlocks();

    // The admin's disabled state is honoured, not overwritten by defaults.
    expect(result.find((b) => b.key === 'local_lviv')?.enabled).toBe(false);
    expect(result.map((b) => b.key).sort()).toEqual([...ALL_DEFAULT_KEYS].sort());
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

    expect(result.map((b) => b.key)).not.toContain('usp');
    expect(result.map((b) => b.key)).toContain('banner_slider');
    expect(result.map((b) => b.key)).toContain('categories');
  });

  it('should preserve custom block order from saved settings', async () => {
    // Full stored list (no missing defaults) — merge must not reorder it.
    const customOrder = ALL_DEFAULT_KEYS.slice()
      .reverse()
      .map((key) => ({ key, label: key, enabled: true }));

    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      id: 1,
      key: 'homepage_blocks',
      value: JSON.stringify(customOrder),
      updatedBy: null,
      updatedAt: new Date(),
    } as never);

    const result = await getHomepageBlocks();

    expect(result.map((b) => b.key)).toEqual(ALL_DEFAULT_KEYS.slice().reverse());
  });
});
