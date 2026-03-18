import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/seo-template', () => ({
  updateSeoTemplate: vi.fn(),
  deleteSeoTemplate: vi.fn(),
  SeoTemplateError: class SeoTemplateError extends Error { statusCode = 400; },
}));

import { PUT, DELETE } from './route';
import { updateSeoTemplate, deleteSeoTemplate } from '@/services/seo-template';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

describe('PUT /api/v1/admin/seo-templates/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates template on success', async () => {
    vi.mocked(updateSeoTemplate).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ titleTemplate: '{name} - Buy' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID on PUT', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ titleTemplate: '{name}' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns SeoTemplateError status code on PUT', async () => {
    const { SeoTemplateError } = await import('@/services/seo-template');
    vi.mocked(updateSeoTemplate).mockRejectedValue(new SeoTemplateError('not found'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ titleTemplate: '{name}' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(updateSeoTemplate).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ titleTemplate: '{name}' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/seo-templates/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes template on success', async () => {
    vi.mocked(deleteSeoTemplate).mockResolvedValue(undefined as any);
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID on DELETE', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns SeoTemplateError status code on DELETE', async () => {
    const { SeoTemplateError } = await import('@/services/seo-template');
    vi.mocked(deleteSeoTemplate).mockRejectedValue(new SeoTemplateError('not found'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(deleteSeoTemplate).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});
