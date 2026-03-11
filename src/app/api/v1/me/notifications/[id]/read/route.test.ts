import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/notification', () => ({
  markAsRead: vi.fn(),
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { PUT } from './route';
import { markAsRead } from '@/services/notification';

const mockMarkAsRead = markAsRead as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: '5' }) };

describe('PUT /api/v1/me/notifications/[id]/read', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks notification as read', async () => {
    mockMarkAsRead.mockResolvedValue(undefined);
    const req = new NextRequest('http://localhost/api/v1/me/notifications/5/read', { method: 'PUT' });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid id', async () => {
    const req = new NextRequest('http://localhost/api/v1/me/notifications/abc/read', { method: 'PUT' });
    const ctx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: 'abc' }) };
    const res = await PUT(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    mockMarkAsRead.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/notifications/5/read', { method: 'PUT' });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
