import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    volumeDiscount: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('volume-pricing service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('VolumePricingError', () => {
    it('should create error with correct properties', async () => {
      const { VolumePricingError } = await import('./volume-pricing');
      const err = new VolumePricingError('test', 404);
      expect(err.message).toBe('test');
      expect(err.name).toBe('VolumePricingError');
      expect(err.statusCode).toBe(404);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('getVolumeDiscount', () => {
    it('should return null when no discount matches (below minQuantity)', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.volumeDiscount.findFirst).mockResolvedValue(null);

      const { getVolumeDiscount } = await import('./volume-pricing');
      const result = await getVolumeDiscount(1, 5, 2);

      expect(result).toBeNull();
    });

    it('should return correct discount at exact minQuantity threshold', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.volumeDiscount.findFirst).mockResolvedValueOnce({
        id: 1,
        productId: 1,
        categoryId: null,
        minQuantity: 10,
        maxQuantity: null,
        discountPercent: 5,
        discountType: 'percentage',
        isActive: true,
        priority: 0,
        startsAt: null,
        endsAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const { getVolumeDiscount } = await import('./volume-pricing');
      const result = await getVolumeDiscount(1, null, 10);

      expect(result).toEqual({ discountPercent: 5, discountType: 'percentage' });
    });

    it('should return product-specific discount over category-wide', async () => {
      const { prisma } = await import('@/lib/prisma');
      // Product-specific discount found
      vi.mocked(prisma.volumeDiscount.findFirst).mockResolvedValueOnce({
        id: 1,
        productId: 1,
        discountPercent: 10,
        discountType: 'percentage',
      } as never);

      const { getVolumeDiscount } = await import('./volume-pricing');
      const result = await getVolumeDiscount(1, 5, 20);

      expect(result).toEqual({ discountPercent: 10, discountType: 'percentage' });
      // Should only call findFirst once (product match found, no need for category)
      expect(prisma.volumeDiscount.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should fall back to category discount when no product discount', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.volumeDiscount.findFirst)
        .mockResolvedValueOnce(null) // no product discount
        .mockResolvedValueOnce({
          id: 2,
          categoryId: 5,
          productId: null,
          discountPercent: 8,
          discountType: 'percentage',
        } as never); // category discount

      const { getVolumeDiscount } = await import('./volume-pricing');
      const result = await getVolumeDiscount(1, 5, 20);

      expect(result).toEqual({ discountPercent: 8, discountType: 'percentage' });
      expect(prisma.volumeDiscount.findFirst).toHaveBeenCalledTimes(2);
    });

    it('should respect date range (startsAt/endsAt included in query)', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.volumeDiscount.findFirst).mockResolvedValueOnce(null);

      const { getVolumeDiscount } = await import('./volume-pricing');
      await getVolumeDiscount(1, null, 10);

      // Verify the query includes date range conditions
      expect(prisma.volumeDiscount.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({ startsAt: null }),
                ]),
              }),
              expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({ endsAt: null }),
                ]),
              }),
            ]),
          }),
        })
      );
    });

    it('should only consider active discounts (isActive in query)', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.volumeDiscount.findFirst).mockResolvedValueOnce(null);

      const { getVolumeDiscount } = await import('./volume-pricing');
      await getVolumeDiscount(1, null, 10);

      expect(prisma.volumeDiscount.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        })
      );
    });

    it('should order by priority desc to get higher priority first', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.volumeDiscount.findFirst).mockResolvedValueOnce(null);

      const { getVolumeDiscount } = await import('./volume-pricing');
      await getVolumeDiscount(1, null, 10);

      expect(prisma.volumeDiscount.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ priority: 'desc' }, { discountPercent: 'desc' }],
        })
      );
    });

    it('should return null when no product discount and categoryId is null', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.volumeDiscount.findFirst).mockResolvedValueOnce(null);

      const { getVolumeDiscount } = await import('./volume-pricing');
      const result = await getVolumeDiscount(1, null, 10);

      expect(result).toBeNull();
      expect(prisma.volumeDiscount.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe('applyVolumeDiscounts', () => {
    it('should return original price when no discount applies', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.volumeDiscount.findFirst).mockResolvedValue(null);

      const { applyVolumeDiscounts } = await import('./volume-pricing');
      const result = await applyVolumeDiscounts([
        { productId: 1, categoryId: null, quantity: 1, price: 100 },
      ]);

      expect(result).toEqual([
        { productId: 1, originalPrice: 100, discountedPrice: 100, discountPercent: 0, quantity: 1 },
      ]);
    });

    it('should apply percentage discount correctly', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.volumeDiscount.findFirst).mockResolvedValueOnce({
        discountPercent: 10,
        discountType: 'percentage',
      } as never);

      const { applyVolumeDiscounts } = await import('./volume-pricing');
      const result = await applyVolumeDiscounts([
        { productId: 1, categoryId: null, quantity: 10, price: 100 },
      ]);

      expect(result[0].discountedPrice).toBe(90);
      expect(result[0].discountPercent).toBe(10);
    });

    it('should apply fixed_amount discount correctly', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.volumeDiscount.findFirst).mockResolvedValueOnce({
        discountPercent: 15,
        discountType: 'fixed_amount',
      } as never);

      const { applyVolumeDiscounts } = await import('./volume-pricing');
      const result = await applyVolumeDiscounts([
        { productId: 1, categoryId: null, quantity: 10, price: 100 },
      ]);

      expect(result[0].discountedPrice).toBe(85);
    });
  });

  describe('deleteVolumeDiscount', () => {
    it('should throw when not found', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.volumeDiscount.findUnique).mockResolvedValue(null);

      const { deleteVolumeDiscount, VolumePricingError } = await import('./volume-pricing');
      await expect(deleteVolumeDiscount(999)).rejects.toThrow(VolumePricingError);
    });

    it('should delete when found', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.volumeDiscount.findUnique).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.volumeDiscount.delete).mockResolvedValue({} as never);

      const { deleteVolumeDiscount } = await import('./volume-pricing');
      await deleteVolumeDiscount(1);

      expect(prisma.volumeDiscount.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('getVolumeDiscounts', () => {
    it('should return empty list by default', async () => {
      const { getVolumeDiscounts } = await import('./volume-pricing');
      const result = await getVolumeDiscounts();
      expect(result).toEqual([]);
    });

    it('should pass filters to query', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.volumeDiscount.findMany).mockResolvedValue([]);

      const { getVolumeDiscounts } = await import('./volume-pricing');
      await getVolumeDiscounts({ productId: 1, isActive: true });

      expect(prisma.volumeDiscount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 1, isActive: true },
        })
      );
    });
  });

  describe('updateVolumeDiscount', () => {
    it('should throw when not found', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.volumeDiscount.findUnique).mockResolvedValue(null);

      const { updateVolumeDiscount, VolumePricingError } = await import('./volume-pricing');
      await expect(updateVolumeDiscount(999, {})).rejects.toThrow(VolumePricingError);
    });

    it('should update with new values preserving existing', async () => {
      const { prisma } = await import('@/lib/prisma');
      const existing = {
        id: 1,
        productId: 1,
        categoryId: null,
        minQuantity: 10,
        maxQuantity: null,
        discountPercent: 5,
        discountType: 'percentage',
        isActive: true,
        priority: 0,
        startsAt: null,
        endsAt: null,
      };
      vi.mocked(prisma.volumeDiscount.findUnique).mockResolvedValue(existing as never);
      vi.mocked(prisma.volumeDiscount.update).mockResolvedValue({ id: 1 } as never);

      const { updateVolumeDiscount } = await import('./volume-pricing');
      await updateVolumeDiscount(1, { discountPercent: 15 });

      expect(prisma.volumeDiscount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            discountPercent: 15,
            minQuantity: 10,
          }),
        })
      );
    });
  });
});
