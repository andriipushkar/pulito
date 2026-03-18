import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/faq', () => ({
  updateFaqItem: vi.fn(),
  deleteFaqItem: vi.fn(),
  FaqError: class FaqError extends Error { statusCode = 400; },
}));

import { PUT, DELETE } from './route';
import { updateFaqItem, deleteFaqItem } from '@/services/faq';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

describe('PUT /api/v1/admin/faq/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates FAQ item on success', async () => {
    vi.mocked(updateFaqItem).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ question: 'Updated question here?' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID on PUT', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ question: 'Updated question here?' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 422 on PUT validation error', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ question: 'ab' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(422);
  });

  it('returns FaqError status code on PUT', async () => {
    const { FaqError } = await import('@/services/faq');
    vi.mocked(updateFaqItem).mockRejectedValue(new (FaqError as any)('not found'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ question: 'Updated question here?' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(updateFaqItem).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ question: 'Updated question here?' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/faq/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes FAQ item on success', async () => {
    vi.mocked(deleteFaqItem).mockResolvedValue(undefined as any);
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID on DELETE', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns FaqError status code on DELETE', async () => {
    const { FaqError } = await import('@/services/faq');
    vi.mocked(deleteFaqItem).mockRejectedValue(new (FaqError as any)('not found'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(deleteFaqItem).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});
