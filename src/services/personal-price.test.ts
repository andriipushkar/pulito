import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    personalPrice: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

describe('personal-price service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty list', async () => {
    const { getPersonalPrices } = await import('./personal-price');
    const result = await getPersonalPrices({ page: 1, limit: 20 });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should throw on delete non-existent', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.personalPrice.findUnique).mockResolvedValue(null);

    const { deletePersonalPrice, PersonalPriceError } = await import('./personal-price');
    await expect(deletePersonalPrice(999)).rejects.toThrow(PersonalPriceError);
  });

  describe('PersonalPriceError', () => {
    it('should create error with correct properties', async () => {
      const { PersonalPriceError } = await import('./personal-price');
      const err = new PersonalPriceError('test', 404);
      expect(err.message).toBe('test');
      expect(err.name).toBe('PersonalPriceError');
      expect(err.statusCode).toBe(404);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('getPersonalPrices with filters', () => {
    it('should apply userId, productId, categoryId filters', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.personalPrice.findMany).mockResolvedValue([]);
      vi.mocked(prisma.personalPrice.count).mockResolvedValue(0);

      const { getPersonalPrices } = await import('./personal-price');
      await getPersonalPrices({ page: 2, limit: 10, userId: 1, productId: 5, categoryId: 3 });

      expect(prisma.personalPrice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 1, productId: 5, categoryId: 3 },
          skip: 10,
          take: 10,
        })
      );
    });
  });

  describe('createPersonalPrice', () => {
    it('should create with all optional fields provided', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.personalPrice.create).mockResolvedValue({ id: 1 } as never);

      const { createPersonalPrice } = await import('./personal-price');
      await createPersonalPrice(
        {
          userId: 1,
          productId: 5,
          categoryId: 3,
          discountPercent: 10,
          fixedPrice: 99,
          validFrom: '2026-01-01T00:00:00Z',
          validUntil: '2026-12-31T00:00:00Z',
        },
        42
      );

      expect(prisma.personalPrice.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          productId: 5,
          categoryId: 3,
          discountPercent: 10,
          fixedPrice: 99,
          validFrom: expect.any(Date),
          validUntil: expect.any(Date),
          createdBy: 42,
        },
        select: expect.any(Object),
      });
    });

    it('should create with null optional fields', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.personalPrice.create).mockResolvedValue({ id: 1 } as never);

      const { createPersonalPrice } = await import('./personal-price');
      await createPersonalPrice({ userId: 1 }, 42);

      expect(prisma.personalPrice.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          productId: null,
          categoryId: null,
          discountPercent: null,
          fixedPrice: null,
          validFrom: null,
          validUntil: null,
          createdBy: 42,
        },
        select: expect.any(Object),
      });
    });
  });

  describe('updatePersonalPrice', () => {
    it('should throw when not found', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.personalPrice.findUnique).mockResolvedValue(null);

      const { updatePersonalPrice, PersonalPriceError } = await import('./personal-price');
      await expect(updatePersonalPrice(999, {})).rejects.toThrow(PersonalPriceError);
    });

    it('should update with new values preserving existing', async () => {
      const { prisma } = await import('@/lib/prisma');
      const existing = {
        id: 1,
        discountPercent: 10,
        fixedPrice: 100,
        validFrom: new Date('2026-01-01'),
        validUntil: new Date('2026-12-31'),
      };
      vi.mocked(prisma.personalPrice.findUnique).mockResolvedValue(existing as never);
      vi.mocked(prisma.personalPrice.update).mockResolvedValue({ id: 1 } as never);

      const { updatePersonalPrice } = await import('./personal-price');
      await updatePersonalPrice(1, { discountPercent: 20 });

      expect(prisma.personalPrice.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          discountPercent: 20,
          fixedPrice: 100,
          validFrom: existing.validFrom,
          validUntil: existing.validUntil,
        },
        select: expect.any(Object),
      });
    });

    it('should update validFrom and validUntil to new dates', async () => {
      const { prisma } = await import('@/lib/prisma');
      const existing = {
        id: 1,
        discountPercent: 10,
        fixedPrice: 100,
        validFrom: new Date('2026-01-01'),
        validUntil: new Date('2026-12-31'),
      };
      vi.mocked(prisma.personalPrice.findUnique).mockResolvedValue(existing as never);
      vi.mocked(prisma.personalPrice.update).mockResolvedValue({ id: 1 } as never);

      const { updatePersonalPrice } = await import('./personal-price');
      await updatePersonalPrice(1, {
        validFrom: '2027-01-01T00:00:00Z',
        validUntil: '2027-12-31T00:00:00Z',
      });

      expect(prisma.personalPrice.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          validFrom: new Date('2027-01-01T00:00:00Z'),
          validUntil: new Date('2027-12-31T00:00:00Z'),
        }),
        select: expect.any(Object),
      });
    });

    it('should set validFrom to null when explicitly passed as empty string', async () => {
      const { prisma } = await import('@/lib/prisma');
      const existing = {
        id: 1,
        discountPercent: 10,
        fixedPrice: 100,
        validFrom: new Date('2026-01-01'),
        validUntil: new Date('2026-12-31'),
      };
      vi.mocked(prisma.personalPrice.findUnique).mockResolvedValue(existing as never);
      vi.mocked(prisma.personalPrice.update).mockResolvedValue({ id: 1 } as never);

      const { updatePersonalPrice } = await import('./personal-price');
      await updatePersonalPrice(1, { validFrom: '', validUntil: '2027-06-01T00:00:00Z' });

      expect(prisma.personalPrice.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          validFrom: null,
          validUntil: expect.any(Date),
        }),
        select: expect.any(Object),
      });
    });

    it('should set validUntil to null when explicitly passed as empty string', async () => {
      const { prisma } = await import('@/lib/prisma');
      const existing = {
        id: 1,
        discountPercent: 10,
        fixedPrice: 100,
        validFrom: new Date('2026-01-01'),
        validUntil: new Date('2026-12-31'),
      };
      vi.mocked(prisma.personalPrice.findUnique).mockResolvedValue(existing as never);
      vi.mocked(prisma.personalPrice.update).mockResolvedValue({ id: 1 } as never);

      const { updatePersonalPrice } = await import('./personal-price');
      await updatePersonalPrice(1, { validUntil: '' });

      expect(prisma.personalPrice.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          validUntil: null,
        }),
        select: expect.any(Object),
      });
    });
  });

  describe('deletePersonalPrice', () => {
    it('should delete when found', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.personalPrice.findUnique).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.personalPrice.delete).mockResolvedValue({} as never);

      const { deletePersonalPrice } = await import('./personal-price');
      await deletePersonalPrice(1);

      expect(prisma.personalPrice.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('getEffectivePrice', () => {
    it('should return product-specific price when found', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.personalPrice.findFirst).mockResolvedValueOnce({
        discountPercent: 15,
        fixedPrice: null,
      } as never);

      const { getEffectivePrice } = await import('./personal-price');
      const result = await getEffectivePrice(1, 10, 5);

      expect(result).toEqual({ discountPercent: 15, fixedPrice: null });
    });

    it('should return product price with fixedPrice', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.personalPrice.findFirst).mockResolvedValueOnce({
        discountPercent: null,
        fixedPrice: 99.99,
      } as never);

      const { getEffectivePrice } = await import('./personal-price');
      const result = await getEffectivePrice(1, 10, 5);

      expect(result).toEqual({ discountPercent: null, fixedPrice: 99.99 });
    });

    it('should fall back to category price when no product price', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.personalPrice.findFirst)
        .mockResolvedValueOnce(null) // no product price
        .mockResolvedValueOnce({ discountPercent: 10, fixedPrice: null } as never); // category price

      const { getEffectivePrice } = await import('./personal-price');
      const result = await getEffectivePrice(1, 10, 5);

      expect(result).toEqual({ discountPercent: 10, fixedPrice: null });
    });

    it('should return null when no product or category price', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.personalPrice.findFirst)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const { getEffectivePrice } = await import('./personal-price');
      const result = await getEffectivePrice(1, 10, 5);

      expect(result).toBeNull();
    });

    it('should return null when no product price and categoryId is null', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.personalPrice.findFirst).mockResolvedValueOnce(null);

      const { getEffectivePrice } = await import('./personal-price');
      const result = await getEffectivePrice(1, 10, null);

      expect(result).toBeNull();
      // Should only call findFirst once (no category lookup)
      expect(prisma.personalPrice.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should return category price with fixedPrice', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.personalPrice.findFirst)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ discountPercent: null, fixedPrice: 50 } as never);

      const { getEffectivePrice } = await import('./personal-price');
      const result = await getEffectivePrice(1, 10, 5);

      expect(result).toEqual({ discountPercent: null, fixedPrice: 50 });
    });
  });
});
