import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    siteSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { evalRepricing, getRepricingRules, saveRepricingRules } from './marketplace-repricing';

beforeEach(() => vi.clearAllMocks());

describe('marketplace-repricing', () => {
  it('returns 0 when no rules configured', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);
    const r = await evalRepricing('rozetka', { stock: 10, now: new Date(), categoryId: 1 });
    expect(r).toBe(0);
  });

  it('matches stock_below rule', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      value: JSON.stringify([
        {
          id: 'r1',
          name: 'Low stock surcharge',
          enabled: true,
          condition: { type: 'stock_below', value: 5 },
          markupPercent: 20,
        },
      ]),
    });
    const r = await evalRepricing('olx', { stock: 3, now: new Date(), categoryId: 1 });
    expect(r).toBe(20);
  });

  it('skips disabled rules', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      value: JSON.stringify([
        {
          id: 'r1',
          name: 'Disabled',
          enabled: false,
          condition: { type: 'always' },
          markupPercent: 50,
        },
      ]),
    });
    const r = await evalRepricing('olx', { stock: 3, now: new Date(), categoryId: 1 });
    expect(r).toBe(0);
  });

  it('uses first matching rule when multiple match', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      value: JSON.stringify([
        {
          id: 'r1',
          name: 'First',
          enabled: true,
          condition: { type: 'stock_below', value: 100 },
          markupPercent: 5,
        },
        {
          id: 'r2',
          name: 'Second',
          enabled: true,
          condition: { type: 'always' },
          markupPercent: 10,
        },
      ]),
    });
    const r = await evalRepricing('olx', { stock: 50, now: new Date(), categoryId: 1 });
    expect(r).toBe(5);
  });

  it('matches date_between window', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      value: JSON.stringify([
        {
          id: 'r1',
          name: 'Holiday sale',
          enabled: true,
          condition: { type: 'date_between', from: '2026-01-01', to: '2026-12-31' },
          markupPercent: -10,
        },
      ]),
    });
    const r = await evalRepricing('olx', {
      stock: 10,
      now: new Date('2026-06-15'),
      categoryId: 1,
    });
    expect(r).toBe(-10);
  });

  it('matches category_in rule', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      value: JSON.stringify([
        {
          id: 'r1',
          name: 'Premium cat',
          enabled: true,
          condition: { type: 'category_in', categoryIds: [5, 10] },
          markupPercent: 15,
        },
      ]),
    });
    const r = await evalRepricing('olx', { stock: 10, now: new Date(), categoryId: 10 });
    expect(r).toBe(15);
  });

  it('clamps markup to ±50% on save', async () => {
    mockPrisma.siteSetting.upsert.mockResolvedValue({});
    await saveRepricingRules('olx', [
      {
        id: 'r1',
        name: 'Greedy',
        enabled: true,
        condition: { type: 'always' },
        markupPercent: 999,
      },
    ]);
    const call = mockPrisma.siteSetting.upsert.mock.calls[0][0];
    const stored = JSON.parse(call.create.value);
    expect(stored[0].markupPercent).toBe(50);
  });
});
