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
  prisma: { blogCategory: { findUnique: (...args: unknown[]) => mockFindUnique(...args) } },
}));

const mockGenerate = vi.fn();
vi.mock('@/services/ai-content', () => ({
  generateForBlog: (...args: unknown[]) => mockGenerate(...args),
}));

const mockRateLimit = vi.fn();
vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockRateLimit(...args),
  RATE_LIMITS: { adminAiGenerate: { prefix: 'rl:adminai:', max: 60, windowSec: 3600 } },
}));

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

import { POST } from './route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/v1/admin/blog/ai-generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const GENERATED = {
  title: 'Стаття',
  excerpt: 'Анонс',
  content: '<h2>Стаття</h2>',
  seoTitle: 'SEO',
  seoDescription: 'Опис',
  tags: ['прання'],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimit.mockResolvedValue({ allowed: true });
  mockGenerate.mockResolvedValue(GENERATED);
});

describe('POST /api/v1/admin/blog/ai-generate', () => {
  it('generates an article for a topic with category name resolved', async () => {
    mockFindUnique.mockResolvedValue({ name: 'Поради' });

    const res = await POST(makeRequest({ topic: 'Як прати пуховик', categoryId: 2 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(GENERATED);
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'Як прати пуховик', categoryName: 'Поради' }),
      expect.any(Object),
    );
  });

  it('422 on a too-short topic', async () => {
    const res = await POST(makeRequest({ topic: 'ab' }));
    expect(res.status).toBe(422);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('429 when the shared AI quota is exhausted', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfter: 120 });
    const res = await POST(makeRequest({ topic: 'Нормальна тема' }));
    expect(res.status).toBe(429);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
