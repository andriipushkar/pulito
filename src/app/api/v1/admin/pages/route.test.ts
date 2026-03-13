import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/static-page', () => ({
  getAllPages: vi.fn(),
  createPage: vi.fn(),
  StaticPageError: class StaticPageError extends Error { statusCode = 400; },
}));

import { GET, POST } from './route';
import { getAllPages, createPage } from '@/services/static-page';

describe('GET /api/v1/admin/pages', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns pages on success', async () => {
    vi.mocked(getAllPages).mockResolvedValue([]);
    const res = await (GET as any)();
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getAllPages).mockRejectedValue(new Error('fail'));
    const res = await (GET as any)();
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/pages', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates page on success', async () => {
    vi.mocked(createPage).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Page', content: 'Content here' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, { user: { id: 1 } } as any);
    expect(res.status).toBe(201);
  });

  it('returns 422 on validation error', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ title: 'x', content: '' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, { user: { id: 1 } } as any);
    expect(res.status).toBe(422);
  });

  it('returns StaticPageError status code', async () => {
    const { StaticPageError } = await import('@/services/static-page');
    vi.mocked(createPage).mockRejectedValue(new (StaticPageError as any)('duplicate slug'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Page', content: 'Content here' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, { user: { id: 1 } } as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(createPage).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Page', content: 'Content here' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, { user: { id: 1 } } as any);
    expect(res.status).toBe(500);
  });
});
