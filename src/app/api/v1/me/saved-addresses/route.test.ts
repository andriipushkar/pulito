import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({
  withAuth:
    (handler: Function) =>
    (...args: unknown[]) =>
      handler(...args, { user: { id: 7 } }),
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
  order: { findMany: vi.fn() },
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const configMock = vi.hoisted(() => ({
  delivery: {
    manualMode: false,
    available: { nova_poshta: true, ukrposhta: true, pickup: true, pallet: true },
    freeShippingThreshold: null,
    pickupInfo: null,
  },
  payment: {
    manualMode: false,
    minOnlineAmount: null,
    available: {
      cod: true,
      bank_transfer: true,
      card_prepay: true,
      online: {
        liqpay: false,
        liqpay_paypart: false,
        monobank: false,
        wayforpay: false,
        apple_pay: false,
        google_pay: false,
      },
    },
  },
}));
vi.mock('@/services/checkout-config', () => ({
  getCheckoutConfig: vi.fn(async () => configMock),
}));

import { GET } from './route';

beforeEach(() => {
  vi.clearAllMocks();
});

const order = (overrides: Record<string, unknown> = {}) => ({
  deliveryMethod: 'nova_poshta',
  deliveryCity: 'Київ',
  deliveryAddress: 'Відділення №5',
  deliveryWarehouseRef: 'whref-1',
  createdAt: new Date('2026-01-01'),
  ...overrides,
});

describe('GET /api/v1/me/saved-addresses', () => {
  it('returns unique addresses', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      order(),
      order(),
      order({ deliveryAddress: 'Відділення №7', deliveryWarehouseRef: 'whref-2' }),
    ]);
    const res = await (GET as unknown as (req: unknown) => Promise<Response>)(
      new Request('http://localhost'),
    );
    const body = await res.json();
    expect(body.data).toHaveLength(2);
  });

  it('filters out unavailable methods', async () => {
    configMock.delivery.available.nova_poshta = false;
    prismaMock.order.findMany.mockResolvedValue([
      order(),
      order({ deliveryMethod: 'pickup', deliveryAddress: 'Самовивіз', deliveryWarehouseRef: null }),
    ]);
    const res = await (GET as unknown as (req: unknown) => Promise<Response>)(
      new Request('http://localhost'),
    );
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].deliveryMethod).toBe('pickup');
    configMock.delivery.available.nova_poshta = true; // reset
  });

  it('caps result at 5 entries', async () => {
    const orders = Array.from({ length: 10 }, (_, i) =>
      order({ deliveryAddress: `Відділення ${i}`, deliveryWarehouseRef: `wh-${i}` }),
    );
    prismaMock.order.findMany.mockResolvedValue(orders);
    const res = await (GET as unknown as (req: unknown) => Promise<Response>)(
      new Request('http://localhost'),
    );
    const body = await res.json();
    expect(body.data).toHaveLength(5);
  });

  it('queries only own user orders', async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    await (GET as unknown as (req: unknown) => Promise<Response>)(new Request('http://localhost'));
    const callArg = prismaMock.order.findMany.mock.calls[0][0];
    expect(callArg.where.userId).toBe(7);
  });
});
