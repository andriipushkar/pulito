import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: (..._roles: string[]) => (handler: Function) => handler,
}));

vi.mock('@/services/chat', () => ({
  createRoom: vi.fn(),
  getRoomsByUser: vi.fn(),
  getUnreadCount: vi.fn(),
}));

vi.mock('@/validators/chat', () => ({
  createRoomSchema: { safeParse: vi.fn() },
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { GET, POST } from './route';
import { createRoom, getRoomsByUser, getUnreadCount } from '@/services/chat';
import { createRoomSchema } from '@/validators/chat';

const mockGetRooms = getRoomsByUser as ReturnType<typeof vi.fn>;
const mockGetUnread = getUnreadCount as ReturnType<typeof vi.fn>;
const mockCreateRoom = createRoom as ReturnType<typeof vi.fn>;
const mockSafeParse = createRoomSchema.safeParse as ReturnType<typeof vi.fn>;

const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/chat', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns chat rooms with unread count', async () => {
    mockGetRooms.mockResolvedValue([{ id: 1, subject: 'Help' }]);
    mockGetUnread.mockResolvedValue(3);
    const req = new NextRequest('http://localhost/api/v1/chat');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.unreadCount).toBe(3);
  });

  it('returns 500 on error', async () => {
    mockGetRooms.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/chat');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/chat', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 on validation error', async () => {
    mockSafeParse.mockReturnValue({ success: false, error: { errors: [{ message: 'invalid' }] } });
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('creates chat room on success', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { subject: 'Need help' } });
    mockCreateRoom.mockResolvedValue({ id: 1, subject: 'Need help' });
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'Need help' }),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
  });

  it('returns 500 on error', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { subject: 'Help' } });
    mockCreateRoom.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'Help' }),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
