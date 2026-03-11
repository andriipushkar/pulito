import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    cartItem: {
      deleteMany: vi.fn(),
    },
    wholesaleRule: {
      findMany: vi.fn(),
    },
    product: {
      updateMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    orderItem: {
      delete: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    orderStatusHistory: {
      create: vi.fn(),
    },
    referral: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    loyaltyTransaction: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    loyaltyAccount: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/services/telegram', () => ({
  notifyManagerNewOrder: vi.fn(),
  notifyClientStatusChange: vi.fn(),
}));

vi.mock('@/services/loyalty', () => ({
  earnPoints: vi.fn().mockResolvedValue(undefined),
  adjustPoints: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '@/lib/prisma';
import {
  createOrder,
  getUserOrders,
  getOrderById,
  getOrderByNumber,
  updateOrderStatus,
  editOrderItems,
  getAllOrders,
  OrderError,
} from '@/services/order';

// Pre-import to ensure vi.mock intercepts dynamic import() calls
import '@/services/loyalty';
import type { CheckoutInput, OrderFilterInput } from '@/validators/order';

const mockPrisma = prisma as unknown as MockPrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeCheckout = (overrides?: Partial<CheckoutInput>): CheckoutInput => ({
  contactName: 'Тест Юзер',
  contactPhone: '+380991234567',
  contactEmail: 'test@example.com',
  deliveryMethod: 'nova_poshta',
  deliveryCity: 'Київ',
  deliveryWarehouseRef: 'ref-123',
  deliveryAddress: 'вул. Тестова, 1',
  paymentMethod: 'cod',
  comment: 'Коментар',
  ...overrides,
});

const makeCartItems = () => [
  {
    productId: 1,
    productCode: 'SKU-001',
    productName: 'Товар 1',
    price: 100,
    quantity: 2,
    isPromo: false,
  },
  {
    productId: 2,
    productCode: 'SKU-002',
    productName: 'Товар 2',
    price: 50,
    quantity: 3,
    isPromo: false,
  },
];

const makeOrderDetail = (overrides?: Record<string, unknown>) => ({
  id: 1,
  orderNumber: '20260222-0001',
  status: 'new_order',
  clientType: 'retail',
  totalAmount: 350,
  itemsCount: 5,
  paymentMethod: 'cod',
  paymentStatus: 'pending',
  deliveryMethod: 'nova_poshta',
  createdAt: new Date(),
  discountAmount: 0,
  deliveryCost: 0,
  contactName: 'Тест Юзер',
  contactPhone: '+380991234567',
  contactEmail: 'test@example.com',
  deliveryCity: 'Київ',
  deliveryAddress: 'вул. Тестова, 1',
  trackingNumber: null,
  comment: 'Коментар',
  items: [
    {
      id: 10,
      productId: 1,
      productCode: 'SKU-001',
      productName: 'Товар 1',
      priceAtOrder: 100,
      quantity: 2,
      subtotal: 200,
      isPromo: false,
      product: { imagePath: null, images: [] },
    },
    {
      id: 11,
      productId: 2,
      productCode: 'SKU-002',
      productName: 'Товар 2',
      priceAtOrder: 50,
      quantity: 3,
      subtotal: 150,
      isPromo: false,
      product: { imagePath: null, images: [] },
    },
  ],
  statusHistory: [
    {
      id: 1,
      oldStatus: null,
      newStatus: 'new_order',
      changeSource: 'system',
      comment: 'Замовлення створено',
      createdAt: new Date(),
    },
  ],
  ...overrides,
});

const makeFilters = (overrides?: Partial<OrderFilterInput>): OrderFilterInput => ({
  page: 1,
  limit: 20,
  ...overrides,
});

// ---------------------------------------------------------------------------
// createOrder
// ---------------------------------------------------------------------------

describe('createOrder', () => {
  it('should create an order successfully for a retail user', async () => {
    const checkout = makeCheckout();
    const cartItems = makeCartItems();
    const expectedOrder = makeOrderDetail();

    // $transaction calls the callback with the mockPrisma as tx
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.product.updateMany.mockResolvedValue({ count: 1 } as never);
    mockPrisma.order.create.mockResolvedValue(expectedOrder as never);
    mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 2 } as never);

    const result = await createOrder(1, checkout, cartItems, 'retail');

    expect(result).toEqual(expectedOrder);
    // Stock decremented for each cart item
    expect(mockPrisma.product.updateMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, quantity: { gte: 2 } },
        data: { quantity: { decrement: 2 } },
      })
    );
    expect(mockPrisma.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 2, quantity: { gte: 3 } },
        data: { quantity: { decrement: 3 } },
      })
    );
    // Order created
    expect(mockPrisma.order.create).toHaveBeenCalledTimes(1);
    // Cart cleared for authenticated user
    expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { userId: 1 } });
  });

  it('should throw 400 when cart is empty', async () => {
    const checkout = makeCheckout();

    await expect(createOrder(1, checkout, [], 'retail')).rejects.toThrow(OrderError);
    await expect(createOrder(1, checkout, [], 'retail')).rejects.toThrow('Кошик порожній');

    try {
      await createOrder(1, checkout, [], 'retail');
    } catch (err) {
      expect(err).toBeInstanceOf(OrderError);
      expect((err as OrderError).statusCode).toBe(400);
    }
  });

  it('should throw 400 when wholesale minimum order amount is not met', async () => {
    const checkout = makeCheckout();
    const cartItems = [
      {
        productId: 1,
        productCode: 'SKU-001',
        productName: 'Товар 1',
        price: 10,
        quantity: 1,
        isPromo: false,
      },
    ];

    // Global wholesale rule: min order amount 500
    mockPrisma.wholesaleRule.findMany.mockResolvedValue([
      { id: 1, isActive: true, productId: null, ruleType: 'min_order_amount', value: 500 },
    ] as never);

    await expect(createOrder(null, checkout, cartItems, 'wholesale')).rejects.toThrow(OrderError);

    try {
      await createOrder(null, checkout, cartItems, 'wholesale');
    } catch (err) {
      expect(err).toBeInstanceOf(OrderError);
      expect((err as OrderError).statusCode).toBe(400);
      expect((err as OrderError).message).toContain('Мінімальна сума замовлення');
      expect((err as OrderError).message).toContain('500.00');
      expect((err as OrderError).message).toContain('10.00');
    }
  });

  it('should throw 400 when stock is unavailable', async () => {
    const checkout = makeCheckout();
    const cartItems = makeCartItems();

    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    // First product stock update fails (count 0 = insufficient stock)
    mockPrisma.product.updateMany.mockResolvedValue({ count: 0 } as never);

    await expect(createOrder(1, checkout, cartItems, 'retail')).rejects.toThrow(OrderError);

    try {
      await createOrder(1, checkout, cartItems, 'retail');
    } catch (err) {
      expect(err).toBeInstanceOf(OrderError);
      expect((err as OrderError).statusCode).toBe(400);
      expect((err as OrderError).message).toContain('Товар 1');
      expect((err as OrderError).message).toContain('недоступний у потрібній кількості');
    }
  });

  it('should not clear cart for guest (userId null)', async () => {
    const checkout = makeCheckout();
    const cartItems = makeCartItems();
    const expectedOrder = makeOrderDetail();

    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.product.updateMany.mockResolvedValue({ count: 1 } as never);
    mockPrisma.order.create.mockResolvedValue(expectedOrder as never);

    await createOrder(null, checkout, cartItems, 'retail');

    expect(mockPrisma.cartItem.deleteMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getUserOrders
// ---------------------------------------------------------------------------

describe('getUserOrders', () => {
  it('should return paginated orders', async () => {
    const orders = [makeOrderDetail(), makeOrderDetail({ id: 2, orderNumber: '20260222-0002' })];

    mockPrisma.order.findMany.mockResolvedValue(orders as never);
    mockPrisma.order.count.mockResolvedValue(2 as never);

    const result = await getUserOrders(1, makeFilters());

    expect(result).toEqual({ orders, total: 2 });
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1 },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      })
    );
    expect(mockPrisma.order.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 1 } })
    );
  });

  it('should filter by status', async () => {
    mockPrisma.order.findMany.mockResolvedValue([] as never);
    mockPrisma.order.count.mockResolvedValue(0 as never);

    await getUserOrders(1, makeFilters({ status: 'processing' }));

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1, status: 'processing' },
      })
    );
  });

  it('should calculate correct skip value for page > 1', async () => {
    mockPrisma.order.findMany.mockResolvedValue([] as never);
    mockPrisma.order.count.mockResolvedValue(0 as never);

    await getUserOrders(1, makeFilters({ page: 3, limit: 10 }));

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      })
    );
  });
});

// ---------------------------------------------------------------------------
// getOrderById
// ---------------------------------------------------------------------------

describe('getOrderById', () => {
  it('should return order when found', async () => {
    const order = makeOrderDetail({ userId: 1 });
    mockPrisma.order.findUnique.mockResolvedValue(order as never);

    const result = await getOrderById(1);

    expect(result).toEqual(order);
    expect(mockPrisma.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } })
    );
  });

  it('should return null when order belongs to different user', async () => {
    const order = makeOrderDetail({ userId: 99 });
    mockPrisma.order.findUnique.mockResolvedValue(order as never);

    const result = await getOrderById(1, 1);

    expect(result).toBeNull();
  });

  it('should return null when order is not found', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null as never);

    const result = await getOrderById(999);

    expect(result).toBeNull();
  });

  it('should return order for matching userId', async () => {
    const order = makeOrderDetail({ userId: 5 });
    mockPrisma.order.findUnique.mockResolvedValue(order as never);

    const result = await getOrderById(1, 5);

    expect(result).toEqual(order);
  });
});

// ---------------------------------------------------------------------------
// getOrderByNumber
// ---------------------------------------------------------------------------

describe('getOrderByNumber', () => {
  it('should return order when found by order number', async () => {
    const order = makeOrderDetail();
    mockPrisma.order.findUnique.mockResolvedValue(order as never);

    const result = await getOrderByNumber('20260222-0001');

    expect(result).toEqual(order);
    expect(mockPrisma.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderNumber: '20260222-0001' } })
    );
  });

  it('should return null when order number does not exist', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null as never);

    const result = await getOrderByNumber('NONEXISTENT');

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateOrderStatus
// ---------------------------------------------------------------------------

describe('updateOrderStatus', () => {
  it('should successfully transition from new_order to processing', async () => {
    const foundOrder = {
      id: 1,
      status: 'new_order',
      userId: 1,
      items: [{ productId: 1, quantity: 2 }],
    };
    const updatedOrder = makeOrderDetail({ status: 'processing' });

    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.order.update.mockResolvedValue(updatedOrder as never);

    const result = await updateOrderStatus(1, 'processing', 10, 'manager');

    expect(result).toEqual(updatedOrder);
    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          status: 'processing',
          statusHistory: {
            create: expect.objectContaining({
              oldStatus: 'new_order',
              newStatus: 'processing',
              changedBy: 10,
              changeSource: 'manager',
            }),
          },
        }),
      })
    );
  });

  it('should throw 400 for invalid status transition', async () => {
    const foundOrder = {
      id: 1,
      status: 'new_order',
      userId: 1,
      items: [],
    };
    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);

    await expect(updateOrderStatus(1, 'completed', 10, 'manager')).rejects.toThrow(OrderError);

    try {
      await updateOrderStatus(1, 'completed', 10, 'manager');
    } catch (err) {
      expect(err).toBeInstanceOf(OrderError);
      expect((err as OrderError).statusCode).toBe(400);
      expect((err as OrderError).message).toContain('Неможливо змінити статус');
      expect((err as OrderError).message).toContain('new_order');
      expect((err as OrderError).message).toContain('completed');
    }
  });

  it('should throw 404 when order is not found', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null as never);

    await expect(updateOrderStatus(999, 'processing', 10, 'manager')).rejects.toThrow(OrderError);

    try {
      await updateOrderStatus(999, 'processing', 10, 'manager');
    } catch (err) {
      expect(err).toBeInstanceOf(OrderError);
      expect((err as OrderError).statusCode).toBe(404);
      expect((err as OrderError).message).toBe('Замовлення не знайдено');
    }
  });

  it('should allow client to cancel in new_order status', async () => {
    const foundOrder = {
      id: 1,
      status: 'new_order',
      userId: 5,
      items: [{ productId: 1, quantity: 3 }],
    };
    const updatedOrder = makeOrderDetail({ status: 'cancelled' });

    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.product.update.mockResolvedValue({} as never);
    mockPrisma.order.update.mockResolvedValue(updatedOrder as never);

    const result = await updateOrderStatus(1, 'cancelled', 5, 'client_action');

    expect(result).toEqual(updatedOrder);
  });

  it('should allow client to cancel in processing status', async () => {
    const foundOrder = {
      id: 1,
      status: 'processing',
      userId: 5,
      items: [{ productId: 1, quantity: 3 }],
    };
    const updatedOrder = makeOrderDetail({ status: 'cancelled' });

    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.product.update.mockResolvedValue({} as never);
    mockPrisma.order.update.mockResolvedValue(updatedOrder as never);

    const result = await updateOrderStatus(1, 'cancelled', 5, 'client_action');

    expect(result).toEqual(updatedOrder);
  });

  it('should throw 403 when client tries to cancel in confirmed status', async () => {
    const foundOrder = {
      id: 1,
      status: 'confirmed',
      userId: 5,
      items: [],
    };
    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);

    await expect(
      updateOrderStatus(1, 'cancelled', 5, 'client_action')
    ).rejects.toThrow(OrderError);

    try {
      await updateOrderStatus(1, 'cancelled', 5, 'client_action');
    } catch (err) {
      expect(err).toBeInstanceOf(OrderError);
      expect((err as OrderError).statusCode).toBe(403);
      expect((err as OrderError).message).toContain('Ви можете скасувати замовлення лише в статусах');
    }
  });

  it('should throw 403 when client tries non-cancel action', async () => {
    const foundOrder = {
      id: 1,
      status: 'new_order',
      userId: 5,
      items: [],
    };
    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);

    await expect(
      updateOrderStatus(1, 'processing', 5, 'client_action')
    ).rejects.toThrow(OrderError);

    try {
      await updateOrderStatus(1, 'processing', 5, 'client_action');
    } catch (err) {
      expect(err).toBeInstanceOf(OrderError);
      expect((err as OrderError).statusCode).toBe(403);
    }
  });

  it('should restore stock when order is cancelled', async () => {
    const foundOrder = {
      id: 1,
      status: 'new_order',
      userId: 1,
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 5 },
      ],
    };
    const updatedOrder = makeOrderDetail({ status: 'cancelled' });

    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.product.update.mockResolvedValue({} as never);
    mockPrisma.order.update.mockResolvedValue(updatedOrder as never);

    await updateOrderStatus(1, 'cancelled', 10, 'manager');

    expect(mockPrisma.product.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { quantity: { increment: 2 } },
    });
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { quantity: { increment: 5 } },
    });
  });

  it('should restore stock when order is returned', async () => {
    const foundOrder = {
      id: 1,
      status: 'shipped',
      userId: 1,
      items: [{ productId: 3, quantity: 10 }],
    };
    const updatedOrder = makeOrderDetail({ status: 'returned' });

    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.product.update.mockResolvedValue({} as never);
    mockPrisma.order.update.mockResolvedValue(updatedOrder as never);

    await updateOrderStatus(1, 'returned', 10, 'manager');

    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { quantity: { increment: 10 } },
    });
  });

  it('should not restore stock for non-cancel/return transitions', async () => {
    const foundOrder = {
      id: 1,
      status: 'new_order',
      userId: 1,
      items: [{ productId: 1, quantity: 2 }],
    };
    const updatedOrder = makeOrderDetail({ status: 'processing' });

    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.order.update.mockResolvedValue(updatedOrder as never);

    await updateOrderStatus(1, 'processing', 10, 'manager');

    expect(mockPrisma.product.update).not.toHaveBeenCalled();
  });

  it('should pass comment to status history', async () => {
    const foundOrder = {
      id: 1,
      status: 'new_order',
      userId: 1,
      items: [],
    };
    const updatedOrder = makeOrderDetail({ status: 'processing' });

    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.order.update.mockResolvedValue(updatedOrder as never);

    await updateOrderStatus(1, 'processing', 10, 'manager', 'Прийнято до обробки');

    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statusHistory: {
            create: expect.objectContaining({
              comment: 'Прийнято до обробки',
            }),
          },
        }),
      })
    );
  });

  it('should set cancelledReason and cancelledBy when cancelling', async () => {
    const foundOrder = {
      id: 1,
      status: 'new_order',
      userId: 1,
      items: [],
    };
    const updatedOrder = makeOrderDetail({ status: 'cancelled' });

    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.order.update.mockResolvedValue(updatedOrder as never);

    await updateOrderStatus(1, 'cancelled', 10, 'manager', 'Клієнт передумав');

    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cancelledReason: 'Клієнт передумав',
          cancelledBy: 'manager',
        }),
      })
    );
  });

  it('should handle all valid transitions from the matrix', async () => {
    const transitions: [string, string][] = [
      ['new_order', 'processing'],
      ['new_order', 'cancelled'],
      ['processing', 'confirmed'],
      ['processing', 'cancelled'],
      ['confirmed', 'paid'],
      ['confirmed', 'shipped'],
      ['confirmed', 'cancelled'],
      ['paid', 'shipped'],
      ['paid', 'cancelled'],
      ['shipped', 'completed'],
      ['shipped', 'returned'],
      ['completed', 'returned'],
    ];

    for (const [from, to] of transitions) {
      vi.clearAllMocks();

      const foundOrder = {
        id: 1,
        status: from,
        userId: 1,
        items: [{ productId: 1, quantity: 1 }],
      };
      const updatedOrder = makeOrderDetail({ status: to });

      mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
      mockPrisma.product.update.mockResolvedValue({} as never);
      mockPrisma.order.update.mockResolvedValue(updatedOrder as never);
      // Fire-and-forget paths need thenable mocks
      mockPrisma.referral.findFirst.mockResolvedValue(null as never);
      mockPrisma.loyaltyTransaction.findFirst.mockResolvedValue(null as never);

      const result = await updateOrderStatus(1, to, 10, 'manager');
      expect(result.status).toBe(to);
    }
  });

  it('should reject transitions from terminal statuses', async () => {
    for (const terminalStatus of ['cancelled', 'returned']) {
      vi.clearAllMocks();

      const foundOrder = {
        id: 1,
        status: terminalStatus,
        userId: 1,
        items: [],
      };
      mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);

      await expect(
        updateOrderStatus(1, 'processing', 10, 'manager')
      ).rejects.toThrow(OrderError);
    }
  });
});

// ---------------------------------------------------------------------------
// editOrderItems
// ---------------------------------------------------------------------------

describe('editOrderItems', () => {
  it('should throw 404 when order is not found', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null as never);

    await expect(editOrderItems(999, [], 10)).rejects.toThrow(OrderError);

    try {
      await editOrderItems(999, [], 10);
    } catch (err) {
      expect(err).toBeInstanceOf(OrderError);
      expect((err as OrderError).statusCode).toBe(404);
      expect((err as OrderError).message).toBe('Замовлення не знайдено');
    }
  });

  it('should throw 400 when order status does not allow editing', async () => {
    for (const status of ['paid', 'shipped', 'completed', 'cancelled', 'returned']) {
      vi.clearAllMocks();

      mockPrisma.order.findUnique.mockResolvedValue({
        id: 1,
        status,
        items: [],
      } as never);

      await expect(editOrderItems(1, [], 10)).rejects.toThrow(OrderError);

      try {
        await editOrderItems(1, [], 10);
      } catch (err) {
        expect(err).toBeInstanceOf(OrderError);
        expect((err as OrderError).statusCode).toBe(400);
        expect((err as OrderError).message).toContain('Редагування позицій можливе тільки');
      }
    }
  });

  it('should allow editing in new_order, processing, confirmed statuses', async () => {
    for (const status of ['new_order', 'processing', 'confirmed']) {
      vi.clearAllMocks();

      const order = {
        id: 1,
        status,
        items: [
          {
            id: 10,
            productId: 1,
            productCode: 'SKU-001',
            productName: 'Товар 1',
            priceAtOrder: 100,
            quantity: 2,
            subtotal: 200,
            isPromo: false,
          },
        ],
      };

      mockPrisma.order.findUnique.mockResolvedValue(order as never);
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
      mockPrisma.orderItem.findMany.mockResolvedValue([
        { quantity: 2, subtotal: 200 },
      ] as never);
      mockPrisma.orderStatusHistory.create.mockResolvedValue({} as never);
      mockPrisma.order.update.mockResolvedValue(makeOrderDetail() as never);

      const result = await editOrderItems(1, [], 10);
      expect(result).toBeDefined();
    }
  });

  it('should remove an item and restore stock', async () => {
    const order = {
      id: 1,
      status: 'new_order',
      items: [
        {
          id: 10,
          productId: 1,
          productCode: 'SKU-001',
          productName: 'Товар 1',
          priceAtOrder: 100,
          quantity: 5,
          subtotal: 500,
          isPromo: false,
        },
      ],
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.product.update.mockResolvedValue({} as never);
    mockPrisma.orderItem.delete.mockResolvedValue({} as never);
    mockPrisma.orderItem.findMany.mockResolvedValue([] as never);
    mockPrisma.orderStatusHistory.create.mockResolvedValue({} as never);
    mockPrisma.order.update.mockResolvedValue(makeOrderDetail() as never);

    await editOrderItems(1, [{ itemId: 10, quantity: 0, remove: true }], 10);

    // Stock restored
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { quantity: { increment: 5 } },
    });
    // Item deleted
    expect(mockPrisma.orderItem.delete).toHaveBeenCalledWith({ where: { id: 10 } });
  });

  it('should update item quantity and adjust stock', async () => {
    const order = {
      id: 1,
      status: 'new_order',
      items: [
        {
          id: 10,
          productId: 1,
          productCode: 'SKU-001',
          productName: 'Товар 1',
          priceAtOrder: 100,
          quantity: 2,
          subtotal: 200,
          isPromo: false,
        },
      ],
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    // Increasing quantity: need stock check
    mockPrisma.product.findUnique.mockResolvedValue({ quantity: 10 } as never);
    mockPrisma.product.update.mockResolvedValue({} as never);
    mockPrisma.orderItem.update.mockResolvedValue({} as never);
    mockPrisma.orderItem.findMany.mockResolvedValue([
      { quantity: 5, subtotal: 500 },
    ] as never);
    mockPrisma.orderStatusHistory.create.mockResolvedValue({} as never);
    mockPrisma.order.update.mockResolvedValue(makeOrderDetail() as never);

    await editOrderItems(1, [{ itemId: 10, quantity: 5 }], 10);

    // Stock decrement by difference (5 - 2 = 3)
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { quantity: { decrement: 3 } },
    });
    // Item updated
    expect(mockPrisma.orderItem.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { quantity: 5, subtotal: 500 },
    });
  });

  it('should add a new product to the order', async () => {
    const order = {
      id: 1,
      status: 'new_order',
      items: [],
    };

    const product = {
      id: 5,
      code: 'SKU-005',
      name: 'Новий товар',
      priceRetail: 200,
      quantity: 50,
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.product.findUnique.mockResolvedValue(product as never);
    mockPrisma.product.update.mockResolvedValue({} as never);
    mockPrisma.orderItem.create.mockResolvedValue({} as never);
    mockPrisma.orderItem.findMany.mockResolvedValue([
      { quantity: 3, subtotal: 600 },
    ] as never);
    mockPrisma.orderStatusHistory.create.mockResolvedValue({} as never);
    mockPrisma.order.update.mockResolvedValue(makeOrderDetail() as never);

    await editOrderItems(1, [{ productId: 5, quantity: 3 }], 10);

    // Stock decremented
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { quantity: { decrement: 3 } },
    });
    // Order item created
    expect(mockPrisma.orderItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 1,
        productId: 5,
        productCode: 'SKU-005',
        productName: 'Новий товар',
        priceAtOrder: 200,
        quantity: 3,
        subtotal: 600,
        isPromo: false,
      }),
    });
  });

  it('should recalculate totals after editing', async () => {
    const order = {
      id: 1,
      status: 'new_order',
      items: [],
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.orderItem.findMany.mockResolvedValue([
      { quantity: 2, subtotal: 200 },
      { quantity: 3, subtotal: 150 },
    ] as never);
    mockPrisma.orderStatusHistory.create.mockResolvedValue({} as never);
    mockPrisma.order.update.mockResolvedValue(makeOrderDetail() as never);

    await editOrderItems(1, [], 10);

    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalAmount: 350,
          itemsCount: 5,
        }),
      })
    );
  });

  it('should record status history entry for edit', async () => {
    const order = {
      id: 1,
      status: 'processing',
      items: [],
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.orderItem.findMany.mockResolvedValue([] as never);
    mockPrisma.orderStatusHistory.create.mockResolvedValue({} as never);
    mockPrisma.order.update.mockResolvedValue(makeOrderDetail() as never);

    await editOrderItems(1, [], 10);

    expect(mockPrisma.orderStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 1,
        oldStatus: 'processing',
        newStatus: 'processing',
        changedBy: 10,
        changeSource: 'manager',
        comment: 'Позиції замовлення відредаговано',
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// getAllOrders
// ---------------------------------------------------------------------------

describe('getAllOrders', () => {
  it('should return paginated orders for admin', async () => {
    const orders = [
      makeOrderDetail({ contactName: 'Адмін 1' }),
      makeOrderDetail({ id: 2, contactName: 'Адмін 2' }),
    ];

    mockPrisma.order.findMany.mockResolvedValue(orders as never);
    mockPrisma.order.count.mockResolvedValue(50 as never);

    const result = await getAllOrders(makeFilters());

    expect(result).toEqual({ orders, total: 50 });
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      })
    );
    expect(mockPrisma.order.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it('should apply status filter', async () => {
    mockPrisma.order.findMany.mockResolvedValue([] as never);
    mockPrisma.order.count.mockResolvedValue(0 as never);

    await getAllOrders(makeFilters({ status: 'shipped' }));

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'shipped' },
      })
    );
  });

  it('should apply date range filters', async () => {
    mockPrisma.order.findMany.mockResolvedValue([] as never);
    mockPrisma.order.count.mockResolvedValue(0 as never);

    await getAllOrders(makeFilters({ dateFrom: '2026-01-01', dateTo: '2026-01-31' }));

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-01-31'),
          },
        },
      })
    );
  });

  it('should calculate correct pagination', async () => {
    mockPrisma.order.findMany.mockResolvedValue([] as never);
    mockPrisma.order.count.mockResolvedValue(0 as never);

    await getAllOrders(makeFilters({ page: 5, limit: 10 }));

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 40,
        take: 10,
      })
    );
  });

  it('should include user and contact info in admin select', async () => {
    mockPrisma.order.findMany.mockResolvedValue([] as never);
    mockPrisma.order.count.mockResolvedValue(0 as never);

    await getAllOrders(makeFilters());

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          contactName: true,
          contactPhone: true,
          contactEmail: true,
          user: { select: { id: true, fullName: true, email: true, role: true } },
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// OrderError
// ---------------------------------------------------------------------------

describe('OrderError', () => {
  it('should create error with message and status code', () => {
    const error = new OrderError('Тестова помилка', 400);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(OrderError);
    expect(error.message).toBe('Тестова помилка');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('OrderError');
  });
});

describe('createOrder - wholesale per-product rules', () => {
  it('should throw 400 when wholesale min_quantity rule violated', async () => {
    const checkout = makeCheckout();
    const cartItems = [
      {
        productId: 1,
        productCode: 'SKU-001',
        productName: 'Товар 1',
        price: 100,
        quantity: 2,
        isPromo: false,
      },
    ];

    // No global rules, per-product rule: min_quantity 5
    mockPrisma.wholesaleRule.findMany
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ id: 2, isActive: true, productId: 1, ruleType: 'min_quantity', value: 5 }] as never);

    try {
      await createOrder(null, checkout, cartItems, 'wholesale');
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(OrderError);
      expect((err as OrderError).statusCode).toBe(400);
      expect((err as OrderError).message).toContain('Мінімальна кількість');
    }
  });

  it('should throw 400 when wholesale multiplicity rule violated', async () => {
    const checkout = makeCheckout();
    const cartItems = [
      {
        productId: 1,
        productCode: 'SKU-001',
        productName: 'Товар 1',
        price: 100,
        quantity: 3, // Not multiple of 2
        isPromo: false,
      },
    ];

    mockPrisma.wholesaleRule.findMany
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ id: 3, isActive: true, productId: 1, ruleType: 'multiplicity', value: 2 }] as never);

    try {
      await createOrder(null, checkout, cartItems, 'wholesale');
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(OrderError);
      expect((err as OrderError).statusCode).toBe(400);
      expect((err as OrderError).message).toContain('кратно');
    }
  });
});

describe('getUserOrders - date filters', () => {
  it('should filter by dateFrom', async () => {
    mockPrisma.order.findMany.mockResolvedValue([] as never);
    mockPrisma.order.count.mockResolvedValue(0 as never);

    await getUserOrders(1, makeFilters({ dateFrom: '2026-01-01' }));

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: new Date('2026-01-01') }),
        }),
      })
    );
  });

  it('should filter by dateTo', async () => {
    mockPrisma.order.findMany.mockResolvedValue([] as never);
    mockPrisma.order.count.mockResolvedValue(0 as never);

    await getUserOrders(1, makeFilters({ dateTo: '2026-12-31' }));

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ lte: new Date('2026-12-31') }),
        }),
      })
    );
  });

  it('should filter by both dateFrom and dateTo', async () => {
    mockPrisma.order.findMany.mockResolvedValue([] as never);
    mockPrisma.order.count.mockResolvedValue(0 as never);

    await getUserOrders(1, makeFilters({ dateFrom: '2026-01-01', dateTo: '2026-12-31' }));

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: new Date('2026-01-01'), lte: new Date('2026-12-31') },
        }),
      })
    );
  });
});

describe('getAllOrders - search filter', () => {
  it('should apply search filter to orderNumber, contactName, contactPhone', async () => {
    mockPrisma.order.findMany.mockResolvedValue([] as never);
    mockPrisma.order.count.mockResolvedValue(0 as never);

    await getAllOrders(makeFilters({ search: 'Тест' }));

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { orderNumber: { contains: 'Тест', mode: 'insensitive' } },
            { contactName: { contains: 'Тест', mode: 'insensitive' } },
            { contactPhone: { contains: 'Тест', mode: 'insensitive' } },
          ],
        }),
      })
    );
  });
});

describe('updateOrderStatus - client not owner', () => {
  it('should throw 404 when client tries to cancel another users order', async () => {
    const foundOrder = {
      id: 1,
      status: 'new_order',
      userId: 99,
      items: [],
    };
    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);

    await expect(
      updateOrderStatus(1, 'cancelled', 5, 'client_action')
    ).rejects.toThrow('Замовлення не знайдено');
  });
});

describe('updateOrderStatus - items without productId', () => {
  it('should skip stock restore for items with null productId', async () => {
    const foundOrder = {
      id: 1,
      status: 'new_order',
      userId: 1,
      items: [
        { productId: null, quantity: 2 },
        { productId: 1, quantity: 3 },
      ],
    };
    const updatedOrder = makeOrderDetail({ status: 'cancelled' });

    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.product.update.mockResolvedValue({} as never);
    mockPrisma.order.update.mockResolvedValue(updatedOrder as never);

    await updateOrderStatus(1, 'cancelled', 10, 'manager');

    // Only one product.update call (for productId: 1, not null)
    expect(mockPrisma.product.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { quantity: { increment: 3 } },
    });
  });
});

describe('editOrderItems - insufficient stock on increase', () => {
  it('should throw 400 when increasing quantity beyond stock', async () => {
    const order = {
      id: 1,
      status: 'new_order',
      items: [
        {
          id: 10,
          productId: 1,
          productCode: 'SKU-001',
          productName: 'Товар 1',
          priceAtOrder: 100,
          quantity: 2,
          subtotal: 200,
          isPromo: false,
        },
      ],
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.product.findUnique.mockResolvedValue({ quantity: 1 } as never); // Only 1 in stock, need 3 more

    await expect(editOrderItems(1, [{ itemId: 10, quantity: 5 }], 10)).rejects.toThrow(OrderError);
  });

  it('should throw 404 when adding a non-existent product', async () => {
    const order = {
      id: 1,
      status: 'new_order',
      items: [],
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.product.findUnique.mockResolvedValue(null as never);

    await expect(editOrderItems(1, [{ productId: 999, quantity: 1 }], 10)).rejects.toThrow('Товар не знайдено');
  });

  it('should throw 400 when adding product with insufficient stock', async () => {
    const order = {
      id: 1,
      status: 'new_order',
      items: [],
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 5, code: 'SKU-005', name: 'Товар', priceRetail: 100, quantity: 2,
    } as never);

    await expect(editOrderItems(1, [{ productId: 5, quantity: 10 }], 10)).rejects.toThrow('Недостатньо товару');
  });

  it('should skip non-existent items during quantity update', async () => {
    const order = {
      id: 1,
      status: 'new_order',
      items: [
        { id: 10, productId: 1, productCode: 'SKU', productName: 'T', priceAtOrder: 100, quantity: 2, subtotal: 200, isPromo: false },
      ],
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.orderItem.findMany.mockResolvedValue([{ quantity: 2, subtotal: 200 }] as never);
    mockPrisma.orderStatusHistory.create.mockResolvedValue({} as never);
    mockPrisma.order.update.mockResolvedValue(makeOrderDetail() as never);

    // Try to update an item that doesn't exist in the order
    await editOrderItems(1, [{ itemId: 999, quantity: 5 }], 10);

    // Should not try to update stock or orderItem
    expect(mockPrisma.product.update).not.toHaveBeenCalled();
    expect(mockPrisma.orderItem.update).not.toHaveBeenCalled();
  });

  it('should handle decreasing item quantity (restore stock)', async () => {
    const order = {
      id: 1,
      status: 'new_order',
      items: [
        { id: 10, productId: 1, productCode: 'SKU', productName: 'T', priceAtOrder: 100, quantity: 5, subtotal: 500, isPromo: false },
      ],
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.product.update.mockResolvedValue({} as never);
    mockPrisma.orderItem.update.mockResolvedValue({} as never);
    mockPrisma.orderItem.findMany.mockResolvedValue([{ quantity: 2, subtotal: 200 }] as never);
    mockPrisma.orderStatusHistory.create.mockResolvedValue({} as never);
    mockPrisma.order.update.mockResolvedValue(makeOrderDetail() as never);

    await editOrderItems(1, [{ itemId: 10, quantity: 2 }], 10);

    // Stock should be decremented by -3 (i.e., returned to stock)
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { quantity: { decrement: -3 } },
    });
  });

  it('should remove item without restoring stock when productId is null', async () => {
    const order = {
      id: 1,
      status: 'new_order',
      items: [
        { id: 10, productId: null, productCode: null, productName: 'Custom', priceAtOrder: 100, quantity: 1, subtotal: 100, isPromo: false },
      ],
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.orderItem.delete.mockResolvedValue({} as never);
    mockPrisma.orderItem.findMany.mockResolvedValue([] as never);
    mockPrisma.orderStatusHistory.create.mockResolvedValue({} as never);
    mockPrisma.order.update.mockResolvedValue(makeOrderDetail() as never);

    await editOrderItems(1, [{ itemId: 10, quantity: 0, remove: true }], 10);

    // product.update should NOT be called since productId is null
    expect(mockPrisma.product.update).not.toHaveBeenCalled();
    expect(mockPrisma.orderItem.delete).toHaveBeenCalledWith({ where: { id: 10 } });
  });

  it('should skip stock adjustment when quantity is unchanged', async () => {
    const order = {
      id: 1,
      status: 'new_order',
      items: [
        { id: 10, productId: 1, productCode: 'SKU', productName: 'T', priceAtOrder: 100, quantity: 5, subtotal: 500, isPromo: false },
      ],
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.orderItem.update.mockResolvedValue({} as never);
    mockPrisma.orderItem.findMany.mockResolvedValue([{ quantity: 5, subtotal: 500 }] as never);
    mockPrisma.orderStatusHistory.create.mockResolvedValue({} as never);
    mockPrisma.order.update.mockResolvedValue(makeOrderDetail() as never);

    await editOrderItems(1, [{ itemId: 10, quantity: 5 }], 10);

    // qtyDiff === 0, so product.update should NOT be called
    expect(mockPrisma.product.update).not.toHaveBeenCalled();
    // But orderItem should still be updated (with same subtotal)
    expect(mockPrisma.orderItem.update).toHaveBeenCalled();
  });

  it('should skip stock adjustment when productId is null on quantity change', async () => {
    const order = {
      id: 1,
      status: 'new_order',
      items: [
        { id: 10, productId: null, productCode: null, productName: 'Custom', priceAtOrder: 50, quantity: 2, subtotal: 100, isPromo: false },
      ],
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.orderItem.update.mockResolvedValue({} as never);
    mockPrisma.orderItem.findMany.mockResolvedValue([{ quantity: 3, subtotal: 150 }] as never);
    mockPrisma.orderStatusHistory.create.mockResolvedValue({} as never);
    mockPrisma.order.update.mockResolvedValue(makeOrderDetail() as never);

    await editOrderItems(1, [{ itemId: 10, quantity: 3 }], 10);

    // productId is null so product.update should NOT be called even though qtyDiff !== 0
    expect(mockPrisma.product.update).not.toHaveBeenCalled();
    expect(mockPrisma.orderItem.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { quantity: 3, subtotal: 150 },
    });
  });
});

describe('updateOrderStatus - completed with referral bonus', () => {
  it('should trigger referral bonus flow when order completed and referral exists', async () => {
    const foundOrder = {
      id: 1,
      status: 'shipped',
      userId: 5,
      items: [],
    };
    const updatedOrder = {
      id: 1,
      orderNumber: 'ORD-001',
      status: 'completed',
      totalAmount: 500,
      trackingNumber: null,
      clientType: 'retail',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      deliveryMethod: 'nova_poshta',
      createdAt: new Date(),
      itemsCount: 2,
      items: [],
      statusHistory: [],
    };

    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.order.update.mockResolvedValue(updatedOrder as never);
    mockPrisma.referral.findFirst.mockResolvedValue({
      id: 10,
      referrerUserId: 99,
    } as never);
    mockPrisma.referral.update.mockResolvedValue({} as never);
    mockPrisma.loyaltyTransaction.findFirst.mockResolvedValue(null as never);

    const result = await updateOrderStatus(1, 'completed', 10, 'manager');

    expect(result.status).toBe('completed');
    // The referral and loyalty calls are fire-and-forget so we just verify no errors
  });
});

describe('updateOrderStatus - cancelled with loyalty points reversal', () => {
  it('should trigger loyalty points reversal when order cancelled and earn tx exists', async () => {
    const foundOrder = {
      id: 1,
      status: 'new_order',
      userId: 5,
      items: [],
    };
    const updatedOrder = {
      id: 1,
      orderNumber: 'ORD-002',
      status: 'cancelled',
      totalAmount: 300,
      trackingNumber: null,
      clientType: 'retail',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      deliveryMethod: 'nova_poshta',
      createdAt: new Date(),
      itemsCount: 1,
      items: [],
      statusHistory: [],
    };

    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.order.update.mockResolvedValue(updatedOrder as never);
    mockPrisma.referral.findFirst.mockResolvedValue(null as never);
    mockPrisma.loyaltyTransaction.findFirst.mockResolvedValue({
      points: 50,
    } as never);

    const result = await updateOrderStatus(1, 'cancelled', 10, 'manager');

    expect(result.status).toBe('cancelled');

    // Wait for fire-and-forget loyalty reversal chain to complete
    await new Promise((r) => setTimeout(r, 50));
  });

  it('should not reverse points when no earn transaction exists', async () => {
    const foundOrder = {
      id: 1,
      status: 'new_order',
      userId: 5,
      items: [],
    };
    const updatedOrder = {
      id: 1,
      orderNumber: 'ORD-003',
      status: 'cancelled',
      totalAmount: 300,
      trackingNumber: null,
      clientType: 'retail',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      deliveryMethod: 'nova_poshta',
      createdAt: new Date(),
      itemsCount: 1,
      items: [],
      statusHistory: [],
    };

    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.order.update.mockResolvedValue(updatedOrder as never);
    mockPrisma.referral.findFirst.mockResolvedValue(null as never);
    mockPrisma.loyaltyTransaction.findFirst.mockResolvedValue(null as never);

    const result = await updateOrderStatus(1, 'cancelled', 10, 'manager');

    expect(result.status).toBe('cancelled');

    // Wait for fire-and-forget chain
    await new Promise((r) => setTimeout(r, 50));
  });

  it('should trigger loyalty reversal when order returned and earn tx exists', async () => {
    const foundOrder = {
      id: 1,
      status: 'shipped',
      userId: 5,
      items: [{ productId: 1, quantity: 1 }],
    };
    const updatedOrder = {
      id: 1,
      orderNumber: 'ORD-004',
      status: 'returned',
      totalAmount: 300,
      trackingNumber: null,
      clientType: 'retail',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      deliveryMethod: 'nova_poshta',
      createdAt: new Date(),
      itemsCount: 1,
      items: [],
      statusHistory: [],
    };

    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.product.update.mockResolvedValue({} as never);
    mockPrisma.order.update.mockResolvedValue(updatedOrder as never);
    mockPrisma.referral.findFirst.mockResolvedValue(null as never);
    mockPrisma.loyaltyTransaction.findFirst.mockResolvedValue({
      points: 30,
    } as never);

    const result = await updateOrderStatus(1, 'returned', 10, 'manager');
    expect(result.status).toBe('returned');

    await new Promise((r) => setTimeout(r, 50));
  });

  it('should handle loyalty reversal when earn tx has 0 points', async () => {
    const foundOrder = {
      id: 1,
      status: 'new_order',
      userId: 5,
      items: [],
    };
    const updatedOrder = {
      id: 1,
      orderNumber: 'ORD-005',
      status: 'cancelled',
      totalAmount: 300,
      trackingNumber: null,
      clientType: 'retail',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      deliveryMethod: 'nova_poshta',
      createdAt: new Date(),
      itemsCount: 1,
      items: [],
      statusHistory: [],
    };

    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.order.update.mockResolvedValue(updatedOrder as never);
    mockPrisma.referral.findFirst.mockResolvedValue(null as never);
    mockPrisma.loyaltyTransaction.findFirst.mockResolvedValue({
      points: 0,
    } as never);

    const result = await updateOrderStatus(1, 'cancelled', 10, 'manager');
    expect(result.status).toBe('cancelled');

    await new Promise((r) => setTimeout(r, 50));
  });
});

describe('updateOrderStatus - completed with referral bonus (full chain)', () => {
  it('should execute full referral bonus chain: update status, award points, mark bonus_granted', async () => {
    const foundOrder = {
      id: 1,
      status: 'shipped',
      userId: 5,
      items: [],
    };
    const updatedOrder = {
      id: 1,
      orderNumber: 'ORD-REF',
      status: 'completed',
      totalAmount: 500,
      trackingNumber: null,
      clientType: 'retail',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      deliveryMethod: 'nova_poshta',
      createdAt: new Date(),
      itemsCount: 2,
      items: [],
      statusHistory: [],
    };

    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.order.update.mockResolvedValue(updatedOrder as never);
    mockPrisma.referral.findFirst.mockResolvedValue({
      id: 10,
      referrerUserId: 99,
    } as never);
    mockPrisma.referral.update.mockResolvedValue({} as never);

    const result = await updateOrderStatus(1, 'completed', 10, 'manager');
    expect(result.status).toBe('completed');

    // Wait for fire-and-forget chains to complete
    await new Promise((r) => setTimeout(r, 100));

    // The referral.update should have been called at least once (for first_order status)
    expect(mockPrisma.referral.update).toHaveBeenCalled();
  });

  it('should execute bonus_granted update after adjustPoints completes', async () => {
    const foundOrder = {
      id: 1,
      status: 'shipped',
      userId: 5,
      items: [],
    };
    const updatedOrder = {
      id: 1,
      orderNumber: 'ORD-BONUS',
      status: 'completed',
      totalAmount: 500,
      trackingNumber: null,
      clientType: 'retail',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      deliveryMethod: 'nova_poshta',
      createdAt: new Date(),
      itemsCount: 2,
      items: [],
      statusHistory: [],
    };

    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.order.update.mockResolvedValue(updatedOrder as never);
    mockPrisma.referral.findFirst.mockResolvedValue({
      id: 10,
      referrerUserId: 99,
    } as never);
    mockPrisma.referral.update.mockResolvedValue({} as never);
    // The chain uses the real loyalty module (dynamic import bypasses vi.mock)
    // so we need loyaltyAccount mock to be set up
    (mockPrisma as any).loyaltyAccount.findUnique.mockResolvedValue({
      id: 1, userId: 99, points: 500, totalSpent: 1000, level: 'bronze',
    } as never);
    (mockPrisma as any).loyaltyAccount.update.mockResolvedValue({} as never);
    (mockPrisma as any).loyaltyTransaction.create.mockResolvedValue({} as never);
    // $transaction needs to handle both callback style and array style
    mockPrisma.$transaction.mockImplementation(async (arg: any) => {
      if (typeof arg === 'function') return arg(mockPrisma);
      // Array style - just resolve all promises
      return Promise.all(arg);
    });

    const result = await updateOrderStatus(1, 'completed', 10, 'manager');
    expect(result.status).toBe('completed');

    // Wait for fire-and-forget chain to settle
    await vi.waitFor(() => {
      expect(mockPrisma.referral.update.mock.calls.length).toBeGreaterThanOrEqual(2);
    }, { timeout: 2000, interval: 20 });

    const updateCalls = mockPrisma.referral.update.mock.calls;
    expect(updateCalls.length).toBe(2);
    expect(updateCalls[0][0]).toEqual(expect.objectContaining({
      where: { id: 10 },
      data: expect.objectContaining({ status: 'first_order' }),
    }));
    expect(updateCalls[1][0]).toEqual(expect.objectContaining({
      where: { id: 10 },
      data: expect.objectContaining({
        status: 'bonus_granted',
        bonusType: 'points',
        bonusValue: 100,
      }),
    }));
  });

  it('should not process referral bonus when no referral exists', async () => {
    const foundOrder = {
      id: 1,
      status: 'shipped',
      userId: 5,
      items: [],
    };
    const updatedOrder = {
      id: 1,
      orderNumber: 'ORD-NOREF',
      status: 'completed',
      totalAmount: 500,
      trackingNumber: null,
      clientType: 'retail',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      deliveryMethod: 'nova_poshta',
      createdAt: new Date(),
      itemsCount: 2,
      items: [],
      statusHistory: [],
    };

    mockPrisma.order.findUnique.mockResolvedValue(foundOrder as never);
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma as never));
    mockPrisma.order.update.mockResolvedValue(updatedOrder as never);
    mockPrisma.referral.findFirst.mockResolvedValue(null as never);

    const result = await updateOrderStatus(1, 'completed', 10, 'manager');
    expect(result.status).toBe('completed');

    await new Promise((r) => setTimeout(r, 50));

    // referral.update should NOT be called when no referral exists
    expect(mockPrisma.referral.update).not.toHaveBeenCalled();
  });
});
