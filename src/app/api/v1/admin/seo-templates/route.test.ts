import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/seo-template', () => ({
  getSeoTemplates: vi.fn(),
  createSeoTemplate: vi.fn(),
  SeoTemplateError: class SeoTemplateError extends Error { statusCode = 400; },
}));

import { GET, POST } from './route';
import { getSeoTemplates, createSeoTemplate } from '@/services/seo-template';

describe('GET /api/v1/admin/seo-templates', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns templates on success', async () => {
    vi.mocked(getSeoTemplates).mockResolvedValue([]);
    const res = await (GET as any)();
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getSeoTemplates).mockRejectedValue(new Error('fail'));
    const res = await (GET as any)();
    expect(res.status).toBe(500);
  });

  it('returns SeoTemplateError status on SeoTemplateError', async () => {
    const { SeoTemplateError } = await import('@/services/seo-template');
    vi.mocked(getSeoTemplates).mockRejectedValue(new SeoTemplateError('bad'));
    const res = await (GET as any)();
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/admin/seo-templates', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates template on success', async () => {
    vi.mocked(createSeoTemplate).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ entityType: 'product', titleTemplate: '{name}' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });

  it('returns 500 on error', async () => {
    vi.mocked(createSeoTemplate).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ entityType: 'product', titleTemplate: '{name}' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });

  it('returns SeoTemplateError status on SeoTemplateError', async () => {
    const { SeoTemplateError } = await import('@/services/seo-template');
    vi.mocked(createSeoTemplate).mockRejectedValue(new SeoTemplateError('duplicate'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ entityType: 'product', titleTemplate: '{name}' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});
