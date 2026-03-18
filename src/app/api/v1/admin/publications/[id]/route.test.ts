import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/publication', () => ({
  updatePublication: vi.fn(),
  deletePublication: vi.fn(),
  PublicationError: class PublicationError extends Error { statusCode = 400; },
}));

import { PUT, DELETE } from './route';
import { updatePublication, deletePublication } from '@/services/publication';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

describe('PUT /api/v1/admin/publications/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates publication on success', async () => {
    vi.mocked(updatePublication).mockResolvedValue({ id: 1 } as any);
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
    const res = await PUT(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns PublicationError status code on PUT', async () => {
    const { PublicationError } = await import('@/services/publication');
    vi.mocked(updatePublication).mockRejectedValue(new PublicationError('not found'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ title: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(updatePublication).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ title: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/publications/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes publication on success', async () => {
    vi.mocked(deletePublication).mockResolvedValue(undefined as any);
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID on DELETE', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns PublicationError status code on DELETE', async () => {
    const { PublicationError } = await import('@/services/publication');
    vi.mocked(deletePublication).mockRejectedValue(new PublicationError('not found'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(deletePublication).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});
