import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    siteSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  PalletDeliveryError,
  getPalletConfig,
  updatePalletConfig,
  calculatePalletDeliveryCost,
  validatePalletOrder,
} from './pallet-delivery';

const mockPrisma = prisma as unknown as {
  siteSetting: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};

describe('PalletDeliveryError', () => {
  it('should create error with message and statusCode', () => {
    const error = new PalletDeliveryError('Test error', 400);
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('PalletDeliveryError');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('getPalletConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return default config when no setting exists', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);

    const config = await getPalletConfig();

    expect(config.enabled).toBe(true);
    expect(config.basePrice).toBe(1500);
    expect(config.pricePerKg).toBe(3);
    expect(config.regions).toHaveLength(5);
    expect(config.freeDeliveryThreshold).toBe(50000);
    expect(config.estimatedDays).toBe('3-5');
  });

  it('should merge stored config with defaults', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      key: 'pallet_delivery_config',
      value: JSON.stringify({ basePrice: 2000, estimatedDays: '5-7' }),
    });

    const config = await getPalletConfig();

    expect(config.basePrice).toBe(2000);
    expect(config.estimatedDays).toBe('5-7');
    // Other fields should be defaults
    expect(config.pricePerKg).toBe(3);
    expect(config.enabled).toBe(true);
  });

  it('should return default config when stored JSON is invalid', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      key: 'pallet_delivery_config',
      value: 'invalid json!!!',
    });

    const config = await getPalletConfig();

    expect(config.basePrice).toBe(1500);
    expect(config.enabled).toBe(true);
  });
});

describe('updatePalletConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should merge new config with current and upsert', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);
    mockPrisma.siteSetting.upsert.mockResolvedValue({} as never);

    const result = await updatePalletConfig({ basePrice: 2000 }, 1);

    expect(result.basePrice).toBe(2000);
    expect(result.pricePerKg).toBe(3); // default
    expect(mockPrisma.siteSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'pallet_delivery_config' },
        update: expect.objectContaining({ updatedBy: 1 }),
        create: expect.objectContaining({ updatedBy: 1 }),
      })
    );
  });

  it('should merge with existing stored config', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      key: 'pallet_delivery_config',
      value: JSON.stringify({ basePrice: 1800, estimatedDays: '2-4' }),
    });
    mockPrisma.siteSetting.upsert.mockResolvedValue({} as never);

    const result = await updatePalletConfig({ pricePerKg: 5 });

    expect(result.basePrice).toBe(1800);
    expect(result.pricePerKg).toBe(5);
    expect(result.estimatedDays).toBe('2-4');
  });

  it('should work without updatedBy parameter', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);
    mockPrisma.siteSetting.upsert.mockResolvedValue({} as never);

    const result = await updatePalletConfig({ enabled: false });

    expect(result.enabled).toBe(false);
    expect(mockPrisma.siteSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ updatedBy: undefined }),
      })
    );
  });
});

describe('calculatePalletDeliveryCost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate delivery cost with region multiplier', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);

    const result = await calculatePalletDeliveryCost(200, 'Захід');

    // basePrice(1500) + 200 * pricePerKg(3) = 2100, * multiplier(1.3) = 2730
    expect(result.cost).toBe(2730);
    expect(result.estimatedDays).toBe('3-5');
    expect(result.isFreeDelivery).toBe(true); // 2730 <= 50000
  });

  it('should calculate without region (multiplier = 1)', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);

    const result = await calculatePalletDeliveryCost(200);

    // basePrice(1500) + 200 * pricePerKg(3) = 2100
    expect(result.cost).toBe(2100);
  });

  it('should use multiplier 1 for unknown region', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);

    const result = await calculatePalletDeliveryCost(200, 'Unknown Region');

    expect(result.cost).toBe(2100); // no multiplier boost
  });

  it('should throw when delivery is disabled', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      key: 'pallet_delivery_config',
      value: JSON.stringify({ enabled: false }),
    });

    await expect(calculatePalletDeliveryCost(200)).rejects.toThrow(PalletDeliveryError);
    await expect(calculatePalletDeliveryCost(200)).rejects.toThrow('тимчасово недоступна');
  });

  it('should throw for weight below minimum', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);

    await expect(calculatePalletDeliveryCost(10)).rejects.toThrow(PalletDeliveryError);
    await expect(calculatePalletDeliveryCost(10)).rejects.toThrow('Мінімальна вага');
  });

  it('should throw for weight above maximum', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);

    await expect(calculatePalletDeliveryCost(6000)).rejects.toThrow(PalletDeliveryError);
    await expect(calculatePalletDeliveryCost(6000)).rejects.toThrow('Максимальна вага');
  });

  it('should handle case-insensitive region matching', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);

    const result = await calculatePalletDeliveryCost(200, 'захід');

    expect(result.cost).toBe(2730); // same as 'Захід'
  });

  it('should report isFreeDelivery=false when cost exceeds threshold', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      key: 'pallet_delivery_config',
      value: JSON.stringify({ freeDeliveryThreshold: 100 }),
    });

    const result = await calculatePalletDeliveryCost(200);

    expect(result.isFreeDelivery).toBe(false);
  });

  it('should report isFreeDelivery=false when threshold is 0', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      key: 'pallet_delivery_config',
      value: JSON.stringify({ freeDeliveryThreshold: 0 }),
    });

    const result = await calculatePalletDeliveryCost(200);

    expect(result.isFreeDelivery).toBe(false);
  });

  it('should handle empty regions array with region param', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      key: 'pallet_delivery_config',
      value: JSON.stringify({ regions: [] }),
    });

    const result = await calculatePalletDeliveryCost(200, 'Захід');

    // No multiplier applied since regions is empty
    expect(result.cost).toBe(2100);
  });
});

describe('validatePalletOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return valid for acceptable order', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);

    const result = await validatePalletOrder(200);

    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it('should return invalid when delivery is disabled', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      key: 'pallet_delivery_config',
      value: JSON.stringify({ enabled: false }),
    });

    const result = await validatePalletOrder(200);

    expect(result.valid).toBe(false);
    expect(result.message).toContain('тимчасово недоступна');
  });

  it('should return invalid for weight below minimum', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);

    const result = await validatePalletOrder(10);

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Мінімальна вага');
    expect(result.message).toContain('10 кг');
  });

  it('should return invalid for weight above maximum', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);

    const result = await validatePalletOrder(6000);

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Максимальна вага');
    expect(result.message).toContain('6000 кг');
  });

  it('should return invalid for unsupported region', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);

    const result = await validatePalletOrder(200, 'Mars');

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Mars');
    expect(result.message).toContain('не підтримується');
  });

  it('should accept valid region (case-insensitive)', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);

    const result = await validatePalletOrder(200, 'захід');

    expect(result.valid).toBe(true);
  });

  it('should skip region validation when no region provided', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);

    const result = await validatePalletOrder(200);

    expect(result.valid).toBe(true);
  });

  it('should skip region validation when regions array is empty', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      key: 'pallet_delivery_config',
      value: JSON.stringify({ regions: [] }),
    });

    const result = await validatePalletOrder(200, 'Any Region');

    // Empty regions array with region param: regions.length === 0, so skip validation
    expect(result.valid).toBe(true);
  });
});
