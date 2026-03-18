import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (req: any, ctx?: any) => handler(req, { ...ctx, user: { id: 99, role: 'admin' } }) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/user', () => ({
  getUserById: vi.fn(),
  updateUserRole: vi.fn(),
  UserError: class UserError extends Error { statusCode = 400; },
}));

import { GET, PUT } from './route';
import { getUserById, updateUserRole } from '@/services/user';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

describe('GET /api/v1/admin/users/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns user on success', async () => {
    vi.mocked(getUserById).mockResolvedValue({ id: 1 } as any);
    const req = new NextRequest('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getUserById).mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/users/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates user role on success', async () => {
    vi.mocked(updateUserRole).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ role: 'admin' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(updateUserRole).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ role: 'admin' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 for non-numeric id', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ role: 'admin' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when no role provided', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ something: 'else' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns UserError status on UserError', async () => {
    const { UserError } = await import('@/services/user');
    vi.mocked(updateUserRole).mockRejectedValue(new UserError('not found'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ role: 'admin' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/admin/users/[id] - edge cases', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 for non-numeric id', async () => {
    const req = new NextRequest('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    vi.mocked(getUserById).mockResolvedValue(null as any);
    const req = new NextRequest('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(404);
  });
});
