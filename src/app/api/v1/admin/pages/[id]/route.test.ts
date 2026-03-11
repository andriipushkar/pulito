import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/static-page', () => ({
  updatePage: vi.fn(),
  deletePage: vi.fn(),
  StaticPageError: class StaticPageError extends Error { statusCode = 400; },
}));

import { PUT, DELETE } from './route';
import { updatePage, deletePage } from '@/services/static-page';

const mockCtx = { user: { id: 1 }, params: Promise.resolve({ id: '1' }) };

describe('PUT /api/v1/admin/pages/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates page on success', async () => {
    vi.mocked(updatePage).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ title: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID on PUT', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ title: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, { user: { id: 1 }, params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 422 on PUT validation error', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ title: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(422);
  });

  it('returns StaticPageError status code on PUT', async () => {
    const { StaticPageError } = await import('@/services/static-page');
    vi.mocked(updatePage).mockRejectedValue(new StaticPageError('not found'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ title: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(updatePage).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ title: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/pages/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes page on success', async () => {
    vi.mocked(deletePage).mockResolvedValue(undefined as any);
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID on DELETE', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns StaticPageError status code on DELETE', async () => {
    const { StaticPageError } = await import('@/services/static-page');
    vi.mocked(deletePage).mockRejectedValue(new StaticPageError('not found'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(deletePage).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});
