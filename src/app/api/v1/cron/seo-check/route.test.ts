import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
    category: { findMany: vi.fn() },
    siteSetting: { upsert: vi.fn() },
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { POST } from './route';
import { prisma } from '@/lib/prisma';

describe('POST /api/v1/cron/seo-check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ status: 200 });
    vi.mocked(prisma.siteSetting.upsert).mockResolvedValue({} as any);
    vi.mocked(prisma.category.findMany).mockResolvedValue([]);
  });

  it('returns 401 without valid authorization', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('detects missing SEO fields', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { slug: 'test', name: 'Test', content: { seoTitle: null, seoDescription: null } },
    ] as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.missingMeta).toBe(2);
  });

  it('detects broken links', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { slug: 'broken', name: 'Broken', content: { seoTitle: 'ok', seoDescription: 'ok' } },
    ] as any);
    mockFetch.mockResolvedValueOnce({ status: 404 });
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.brokenLinks).toBe(1);
  });

  it('handles no products gracefully', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.totalIssues).toBe(0);
  });

  it('sends Telegram alert on broken links', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_MANAGER_CHAT_ID = 'test-chat';
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { slug: 'broken', name: 'Broken', content: { seoTitle: 'ok', seoDescription: 'ok' } },
    ] as any);
    mockFetch.mockResolvedValueOnce({ status: 404 }); // product page check
    mockFetch.mockResolvedValueOnce({ ok: true }); // telegram send
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    // fetch called: 1 product HEAD + 1 upsert (via prisma, not fetch) + 1 telegram
    expect(mockFetch).toHaveBeenCalledTimes(2);
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_MANAGER_CHAT_ID;
  });

  it('returns 500 on top-level error', async () => {
    vi.mocked(prisma.product.findMany).mockRejectedValue(new Error('db error'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
