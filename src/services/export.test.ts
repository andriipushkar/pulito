import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';
import { ExportError, exportOrders, exportClients, exportCatalog } from './export';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
const mockPrisma = prisma as unknown as MockPrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ExportError', () => {
  it('should have correct name and default statusCode', () => {
    const err = new ExportError('test');
    expect(err.name).toBe('ExportError');
    expect(err.statusCode).toBe(400);
  });
});

describe('exportOrders', () => {
  it('should return xlsx buffer for orders', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      {
        orderNumber: 'ORD-001',
        createdAt: new Date('2024-01-15'),
        contactName: 'Тарас',
        contactPhone: '+380501234567',
        contactEmail: 'test@test.com',
        clientType: 'retail',
        status: 'new',
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        deliveryMethod: 'nova_poshta',
        deliveryCity: 'Київ',
        itemsCount: 2,
        discountAmount: 0,
        deliveryCost: 50,
        totalAmount: 500,
        comment: null,
        items: [],
        user: { fullName: 'Тарас', email: 'test@test.com' },
      },
    ] as never);

    const result = await exportOrders();
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.filename).toContain('orders_');
    expect(result.filename).toMatch('.xlsx');
    expect(result.contentType).toContain('spreadsheet');
  });

  it('should support csv format', async () => {
    mockPrisma.order.findMany.mockResolvedValue([] as never);

    const result = await exportOrders({ format: 'csv' });
    expect(result.filename).toMatch('.csv');
    expect(result.contentType).toBe('text/csv');
  });

  it('should apply date filters', async () => {
    mockPrisma.order.findMany.mockResolvedValue([] as never);

    await exportOrders({ dateFrom: '2024-01-01', dateTo: '2024-12-31' });
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    );
  });
});

describe('exportClients', () => {
  it('should return xlsx buffer for clients', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 1,
        email: 'test@test.com',
        fullName: 'Тарас',
        phone: '+380501234567',
        companyName: null,
        edrpou: null,
        role: 'customer',
        wholesaleStatus: null,
        createdAt: new Date('2024-01-10'),
        _count: { orders: 5 },
      },
    ] as never);

    const result = await exportClients();
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.filename).toContain('clients_');
  });
});

describe('exportCatalog', () => {
  it('should return xlsx buffer for catalog', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      {
        code: 'P001',
        name: 'Порошок для прання',
        category: { name: 'Прання' },
        priceRetail: 150,
        priceWholesale: 120,
        quantity: 50,
        isPromo: false,
        isActive: true,
      },
    ] as never);

    const result = await exportCatalog();
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.filename).toContain('catalog_');
  });

  it('should support csv format', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);

    const result = await exportCatalog({ format: 'csv' });
    expect(result.filename).toMatch('.csv');
    expect(result.contentType).toBe('text/csv');
  });

  it('should handle products without category', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      {
        code: 'P002',
        name: 'Без категорії',
        category: null,
        priceRetail: 50,
        priceWholesale: 40,
        quantity: 10,
        isPromo: true,
        isActive: true,
      },
    ] as never);

    const result = await exportCatalog();
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });
});

describe('exportOrders - additional filters', () => {
  it('should apply status filter', async () => {
    mockPrisma.order.findMany.mockResolvedValue([] as never);

    await exportOrders({ status: 'completed' });
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'completed' }),
      }),
    );
  });

  it('should apply clientType filter', async () => {
    mockPrisma.order.findMany.mockResolvedValue([] as never);

    await exportOrders({ clientType: 'wholesale' });
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientType: 'wholesale' }),
      }),
    );
  });

  it('should handle orders with null comment and email', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      {
        orderNumber: 'ORD-002',
        createdAt: new Date('2024-02-01'),
        contactName: 'Тест',
        contactPhone: '+380501234567',
        contactEmail: null,
        clientType: 'wholesale',
        status: 'processing',
        paymentMethod: 'liqpay',
        paymentStatus: 'paid',
        deliveryMethod: 'nova_poshta',
        deliveryCity: null,
        itemsCount: 1,
        discountAmount: 10,
        deliveryCost: 0,
        totalAmount: 200,
        comment: null,
        items: [],
        user: null,
      },
    ] as never);

    const result = await exportOrders();
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });
});

describe('exportClients - additional', () => {
  it('should support csv format', async () => {
    mockPrisma.user.findMany.mockResolvedValue([] as never);

    const result = await exportClients({ format: 'csv' });
    expect(result.filename).toMatch('.csv');
    expect(result.contentType).toBe('text/csv');
  });

  it('should apply role filter', async () => {
    mockPrisma.user.findMany.mockResolvedValue([] as never);

    await exportClients({ role: 'admin' });
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: 'admin' }),
      }),
    );
  });
});

describe('ExportError - additional', () => {
  it('should accept custom statusCode', () => {
    const err = new ExportError('not found', 404);
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe('ExportError');
  });
});

describe('exportOrders - dateFrom only filter', () => {
  it('should apply dateFrom without dateTo', async () => {
    mockPrisma.order.findMany.mockResolvedValue([] as never);

    await exportOrders({ dateFrom: '2024-01-01' });
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it('should apply dateTo without dateFrom', async () => {
    mockPrisma.order.findMany.mockResolvedValue([] as never);

    await exportOrders({ dateTo: '2024-12-31' });
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            lte: expect.any(Date),
          }),
        }),
      }),
    );
  });
});

describe('exportClients - csv format with role filter', () => {
  it('should apply both role filter and csv format simultaneously', async () => {
    mockPrisma.user.findMany.mockResolvedValue([] as never);

    const result = await exportClients({ role: 'customer', format: 'csv' });
    expect(result.filename).toMatch('.csv');
    expect(result.contentType).toBe('text/csv');
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: 'customer' }),
      }),
    );
  });
});

describe('exportClients - null optional fields (lines 111-112)', () => {
  it('should handle null fullName, phone, companyName, edrpou, wholesaleStatus', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 2,
        email: 'minimal@test.com',
        fullName: null,
        phone: null,
        companyName: null,
        edrpou: null,
        role: 'customer',
        wholesaleStatus: null,
        createdAt: new Date('2024-03-15'),
        _count: { orders: 0 },
      },
    ] as never);

    const result = await exportClients();
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });
});

describe('exportCatalog - csv content type', () => {
  it('should return correct csv content type for catalog', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);

    const result = await exportCatalog({ format: 'csv' });
    expect(result.contentType).toBe('text/csv');
  });
});
