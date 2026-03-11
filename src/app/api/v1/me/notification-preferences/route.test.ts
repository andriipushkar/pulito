import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET, PUT } from './route';
import { prisma } from '@/lib/prisma';

const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.user.update as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/me/notification-preferences', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns notification preferences with defaults', async () => {
    mockFindUnique.mockResolvedValue({ notificationPrefs: { email_promo: false } });
    const req = new NextRequest('http://localhost/api/v1/me/notification-preferences');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.email_orders).toBe(true);
    expect(json.data.email_promo).toBe(false);
  });

  it('returns 500 on error', async () => {
    mockFindUnique.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/notification-preferences');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns defaults when user has no notificationPrefs', async () => {
    mockFindUnique.mockResolvedValue({ notificationPrefs: null });
    const req = new NextRequest('http://localhost/api/v1/me/notification-preferences');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.email_orders).toBe(true);
  });
});

describe('PUT /api/v1/me/notification-preferences', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates preferences', async () => {
    mockFindUnique.mockResolvedValue({ notificationPrefs: {} });
    mockUpdate.mockResolvedValue({});
    const req = new NextRequest('http://localhost/api/v1/me/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify({ email_promo: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockFindUnique.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify({ email_promo: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns 422 on validation failure', async () => {
    const req = new NextRequest('http://localhost/api/v1/me/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify({ email_promo: 'not-a-boolean' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(422);
  });

  it('merges with null notificationPrefs', async () => {
    mockFindUnique.mockResolvedValue({ notificationPrefs: null });
    mockUpdate.mockResolvedValue({});
    const req = new NextRequest('http://localhost/api/v1/me/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify({ email_promo: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(200);
  });
});
