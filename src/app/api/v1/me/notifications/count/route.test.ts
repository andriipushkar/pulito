import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/notification', () => ({
  getUnreadCount: vi.fn(),
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET } from './route';
import { getUnreadCount } from '@/services/notification';

const mockGetUnreadCount = getUnreadCount as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/me/notifications/count', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns unread count', async () => {
    mockGetUnreadCount.mockResolvedValue(5);
    const req = new NextRequest('http://localhost/api/v1/me/notifications/count');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.count).toBe(5);
  });

  it('returns 500 on error', async () => {
    mockGetUnreadCount.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/notifications/count');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
