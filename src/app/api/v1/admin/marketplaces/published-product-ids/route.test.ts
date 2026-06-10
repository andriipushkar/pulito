import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    publication: { findMany: (...args: unknown[]) => mockFindMany(...args) },
  },
}));

vi.mock('@/middleware/auth', () => ({
  withRole:
    () =>
    (handler: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) =>
      handler(...args),
}));

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
  },
}));

vi.mock('@/services/marketplaces', () => ({
  MARKETPLACE_CHANNELS: ['olx', 'rozetka', 'prom', 'epicentrk'] as const,
}));

import { GET } from './route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/admin/marketplaces/published-product-ids', () => {
  it('groups product IDs by marketplace channel', async () => {
    mockFindMany.mockResolvedValue([
      { productId: 1, channels: ['olx', 'rozetka'] },
      { productId: 2, channels: ['olx'] },
      { productId: 3, channels: ['prom'] },
    ]);

    const res = await GET(
      new NextRequest('http://localhost/api/v1/admin/marketplaces/published-product-ids'),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.olx).toEqual(expect.arrayContaining([1, 2]));
    expect(body.data.rozetka).toEqual([1]);
    expect(body.data.prom).toEqual([3]);
    expect(body.data.epicentrk).toEqual([]);
  });

  it('deduplicates product IDs republished to the same channel', async () => {
    mockFindMany.mockResolvedValue([
      { productId: 7, channels: ['olx'] },
      { productId: 7, channels: ['olx'] },
      { productId: 7, channels: ['olx', 'rozetka'] },
    ]);

    const res = await GET(
      new NextRequest('http://localhost/api/v1/admin/marketplaces/published-product-ids'),
    );
    const body = await res.json();

    expect(body.data.olx).toEqual([7]);
    expect(body.data.rozetka).toEqual([7]);
  });

  it('ignores non-marketplace channels (e.g. telegram)', async () => {
    mockFindMany.mockResolvedValue([
      { productId: 1, channels: ['telegram', 'olx'] },
      { productId: 2, channels: ['facebook'] },
    ]);

    const res = await GET(
      new NextRequest('http://localhost/api/v1/admin/marketplaces/published-product-ids'),
    );
    const body = await res.json();

    expect(body.data.olx).toEqual([1]);
    expect(body.data.rozetka).toEqual([]);
  });

  it('skips publications without a productId', async () => {
    mockFindMany.mockResolvedValue([
      { productId: null, channels: ['olx'] },
      { productId: 5, channels: ['olx'] },
    ]);

    const res = await GET(
      new NextRequest('http://localhost/api/v1/admin/marketplaces/published-product-ids'),
    );
    const body = await res.json();

    expect(body.data.olx).toEqual([5]);
  });

  it('tolerates non-array channels payload', async () => {
    mockFindMany.mockResolvedValue([
      { productId: 1, channels: null },
      { productId: 2, channels: 'olx' },
      { productId: 3, channels: ['olx'] },
    ]);

    const res = await GET(
      new NextRequest('http://localhost/api/v1/admin/marketplaces/published-product-ids'),
    );
    const body = await res.json();

    expect(body.data.olx).toEqual([3]);
  });

  it('returns 500 on database error', async () => {
    mockFindMany.mockRejectedValue(new Error('DB down'));

    const res = await GET(
      new NextRequest('http://localhost/api/v1/admin/marketplaces/published-product-ids'),
    );
    expect(res.status).toBe(500);
  });
});
