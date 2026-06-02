import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({
  withRole:
    (..._roles: string[]) =>
    (handler: Function) =>
    (...args: unknown[]) =>
      handler(...args),
}));
vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'x'.repeat(32),
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    APP_URL: 'https://test.com',
  },
}));

const prismaMock = vi.hoisted(() => ({
  siteSetting: { findMany: vi.fn() },
  order: { findMany: vi.fn(), update: vi.fn() },
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const npMock = vi.hoisted(() => ({
  createInternetDocument: vi.fn(),
  NovaPoshtaError: class extends Error {
    constructor(
      msg: string,
      public statusCode = 400,
    ) {
      super(msg);
    }
  },
}));
vi.mock('@/services/nova-poshta', () => npMock);

import { POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.siteSetting.findMany.mockResolvedValue([
    { key: 'delivery_nova_poshta_api_key', value: 'k' },
    { key: 'delivery_nova_poshta_sender_ref', value: 'sender-ref' },
    { key: 'delivery_nova_poshta_sender_warehouse_ref', value: 'wh-ref' },
    { key: 'delivery_nova_poshta_sender_phone', value: '+380501234567' },
  ]);
  prismaMock.order.update.mockResolvedValue({});
});

function makeReq(body: unknown): Request {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/admin/orders/bulk-ttn', () => {
  it('rejects empty orderIds', async () => {
    const res = await POST(makeReq({ orderIds: [] }) as any);
    expect(res.status).toBe(422);
  });

  it('returns 400 when NP API key not configured', async () => {
    prismaMock.siteSetting.findMany.mockResolvedValueOnce([]); // no api_key
    const res = await POST(makeReq({ orderIds: [1] }) as any);
    expect(res.status).toBe(400);
  });

  it('skips order that already has a TTN', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: 1,
        orderNumber: 'ORD-1',
        contactName: 'A',
        contactPhone: '+380501112233',
        deliveryCity: 'cityRef',
        deliveryWarehouseRef: 'whRef',
        deliveryStreetRef: null,
        deliveryBuilding: null,
        deliveryFlat: null,
        deliveryMethod: 'nova_poshta',
        trackingNumber: 'EXISTING-123',
        totalAmount: 100,
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        items: [{ quantity: 1 }],
      },
    ]);
    const res = await POST(makeReq({ orderIds: [1] }) as any);
    const body = await res.json();
    expect(body.data.failed[0].error).toBe('TTN вже існує');
    expect(npMock.createInternetDocument).not.toHaveBeenCalled();
  });

  it('skips non-nova_poshta order', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: 1,
        orderNumber: 'ORD-1',
        contactName: 'A',
        contactPhone: '+380501112233',
        deliveryCity: 'city',
        deliveryWarehouseRef: 'wh',
        deliveryStreetRef: null,
        deliveryBuilding: null,
        deliveryFlat: null,
        deliveryMethod: 'ukrposhta',
        trackingNumber: null,
        totalAmount: 100,
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        items: [{ quantity: 1 }],
      },
    ]);
    const res = await POST(makeReq({ orderIds: [1] }) as any);
    const body = await res.json();
    expect(body.data.failed[0].error).toBe('Не Нова Пошта');
  });

  it('creates TTN for warehouse-mode order with COD', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: 5,
        orderNumber: 'ORD-5',
        contactName: 'A',
        contactPhone: '+380501112233',
        deliveryCity: 'cityRef',
        deliveryWarehouseRef: 'whRef',
        deliveryStreetRef: null,
        deliveryBuilding: null,
        deliveryFlat: null,
        deliveryMethod: 'nova_poshta',
        trackingNumber: null,
        totalAmount: 250,
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        items: [{ quantity: 2 }],
      },
    ]);
    npMock.createInternetDocument.mockResolvedValue({
      intDocNumber: 'NEW-ID-77',
      ref: 'r',
      costOnSite: 0,
      estimatedDeliveryDate: '',
    });
    const res = await POST(makeReq({ orderIds: [5] }) as any);
    const body = await res.json();
    expect(body.data.ok).toHaveLength(1);
    expect(body.data.ok[0].trackingNumber).toBe('NEW-ID-77');
    // COD amount must be passed
    const callArg = npMock.createInternetDocument.mock.calls[0][0];
    expect(callArg.codAmount).toBe(250);
    expect(callArg.serviceType).toBe('WarehouseWarehouse');
  });

  it('creates TTN for D2D order (street + building present)', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: 6,
        orderNumber: 'ORD-6',
        contactName: 'B',
        contactPhone: '+380501112233',
        deliveryCity: 'cityRef',
        deliveryWarehouseRef: null,
        deliveryStreetRef: 'streetRef',
        deliveryBuilding: '12',
        deliveryFlat: '5',
        deliveryMethod: 'nova_poshta',
        trackingNumber: null,
        totalAmount: 300,
        paymentMethod: 'bank_transfer',
        paymentStatus: 'paid',
        items: [{ quantity: 1 }],
      },
    ]);
    npMock.createInternetDocument.mockResolvedValue({
      intDocNumber: 'D2D-99',
      ref: 'r',
      costOnSite: 0,
      estimatedDeliveryDate: '',
    });
    const res = await POST(makeReq({ orderIds: [6] }) as any);
    const body = await res.json();
    expect(body.data.ok[0].trackingNumber).toBe('D2D-99');
    const callArg = npMock.createInternetDocument.mock.calls[0][0];
    expect(callArg.serviceType).toBe('WarehouseDoors');
    expect(callArg.recipientStreetRef).toBe('streetRef');
    expect(callArg.recipientBuilding).toBe('12');
    expect(callArg.recipientFlat).toBe('5');
    expect(callArg.codAmount).toBeUndefined();
  });

  it('handles partial failures — successful + failed in same batch', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: 1,
        orderNumber: 'OK',
        contactName: 'A',
        contactPhone: '+380501112233',
        deliveryCity: 'c',
        deliveryWarehouseRef: 'w',
        deliveryStreetRef: null,
        deliveryBuilding: null,
        deliveryFlat: null,
        deliveryMethod: 'nova_poshta',
        trackingNumber: null,
        totalAmount: 100,
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        items: [{ quantity: 1 }],
      },
      {
        id: 2,
        orderNumber: 'BAD',
        contactName: 'B',
        contactPhone: '+380501112233',
        deliveryCity: 'c',
        deliveryWarehouseRef: 'w',
        deliveryStreetRef: null,
        deliveryBuilding: null,
        deliveryFlat: null,
        deliveryMethod: 'nova_poshta',
        trackingNumber: null,
        totalAmount: 100,
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        items: [{ quantity: 1 }],
      },
    ]);
    npMock.createInternetDocument
      .mockResolvedValueOnce({
        intDocNumber: 'OK-1',
        ref: 'r',
        costOnSite: 0,
        estimatedDeliveryDate: '',
      })
      // 4xx = permanent failure (non-retryable); 5xx/429 would trigger the
      // route's backoff-retry and succeed on the mock's next call.
      .mockRejectedValueOnce(new npMock.NovaPoshtaError('NP отказала', 400));
    const res = await POST(makeReq({ orderIds: [1, 2] }) as any);
    const body = await res.json();
    expect(body.data.ok).toHaveLength(1);
    expect(body.data.failed).toHaveLength(1);
    expect(body.data.failed[0].error).toBe('NP отказала');
  });

  it('skips order missing both warehouse and street', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: 9,
        orderNumber: 'ORD-9',
        contactName: 'A',
        contactPhone: '+380501112233',
        deliveryCity: 'c',
        deliveryWarehouseRef: null,
        deliveryStreetRef: null,
        deliveryBuilding: null,
        deliveryFlat: null,
        deliveryMethod: 'nova_poshta',
        trackingNumber: null,
        totalAmount: 100,
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        items: [{ quantity: 1 }],
      },
    ]);
    const res = await POST(makeReq({ orderIds: [9] }) as any);
    const body = await res.json();
    expect(body.data.failed[0].error).toContain('Немає');
  });
});
