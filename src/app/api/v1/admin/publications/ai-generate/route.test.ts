import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    APP_URL: 'https://test.com',
  },
}));

vi.mock('@/middleware/auth', () => {
  const roleWrap =
    (..._roles: unknown[]) =>
    (handler: (req: unknown, ctx: Record<string, unknown>) => unknown) =>
    (req: unknown, ctx?: Record<string, unknown>) =>
      handler(req, { user: { id: 1, email: 'admin@test.com', role: 'admin' }, ...(ctx || {}) });
  return { withRole: roleWrap, withRole2fa: roleWrap };
});

const mockFindUnique = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: { product: { findUnique: (...args: unknown[]) => mockFindUnique(...args) } },
}));

const mockGenerate = vi.fn();
vi.mock('@/services/ai-content', () => ({
  generateSocialPost: (...args: unknown[]) => mockGenerate(...args),
}));

const mockRateLimit = vi.fn();
vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockRateLimit(...args),
  RATE_LIMITS: { adminAiGenerate: { prefix: 'rl:adminai:', max: 60, windowSec: 3600 } },
}));

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

import { POST } from './route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/v1/admin/publications/ai-generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const GENERATED = {
  title: 'Назва',
  content: 'Текст',
  hashtags: '#pulitotrade',
  firstComment: 'Перший коментар',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimit.mockResolvedValue({ allowed: true });
  mockGenerate.mockResolvedValue(GENERATED);
});

describe('POST /api/v1/admin/publications/ai-generate', () => {
  it('generates from a product with brand/category/price/url', async () => {
    mockFindUnique.mockResolvedValue({
      name: 'Гель Dash',
      slug: 'gel-dash',
      priceRetail: 189,
      priceRetailOld: 220,
      brand: { name: 'Dash' },
      category: { name: 'Прання' },
      content: { shortDescription: 'Гель для прання' },
    });

    const res = await POST(makeRequest({ productId: 5, channels: ['telegram'] }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(GENERATED);
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        productName: 'Гель Dash',
        brand: 'Dash',
        category: 'Прання',
        price: 189,
        oldPrice: 220,
        productUrl: 'https://test.com/product/gel-dash',
        shortDescription: 'Гель для прання',
      }),
      expect.any(Object),
    );
  });

  it('generates from a free topic without touching the DB', async () => {
    const res = await POST(makeRequest({ topic: 'Прибирання навесні' }));

    expect(res.status).toBe(200);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'Прибирання навесні', productUrl: null }),
      expect.any(Object),
    );
  });

  it('422 when neither product nor topic given', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(422);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('404 when the product does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ productId: 999 }));
    expect(res.status).toBe(404);
  });

  it('429 when the AI quota is exhausted', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfter: 60 });
    const res = await POST(makeRequest({ topic: 'тема для поста' }));
    expect(res.status).toBe(429);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
