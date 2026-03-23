import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: (..._roles: string[]) => (handler: Function) => handler,
}));

vi.mock('@/services/chat', () => {
  class ChatError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    markMessagesAsRead: vi.fn(),
    getRoomById: vi.fn(),
    ChatError,
  };
});

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { POST } from './route';
import { markMessagesAsRead, getRoomById, ChatError } from '@/services/chat';

const mockMarkRead = markMessagesAsRead as ReturnType<typeof vi.fn>;
const mockGetRoom = getRoomById as ReturnType<typeof vi.fn>;

const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ roomId: '5' }) };
const invalidCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ roomId: 'abc' }) };

describe('POST /api/v1/chat/[roomId]/read', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for invalid roomId', async () => {
    const req = new NextRequest('http://localhost', { method: 'POST' });
    const res = await POST(req, invalidCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 403 if user does not own room', async () => {
    mockGetRoom.mockResolvedValue({ id: 5, userId: 99 });
    const req = new NextRequest('http://localhost', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(403);
  });

  it('marks messages as read on success', async () => {
    mockGetRoom.mockResolvedValue({ id: 5, userId: 1 });
    mockMarkRead.mockResolvedValue({ count: 3 });
    const req = new NextRequest('http://localhost', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.updated).toBe(3);
  });

  it('returns ChatError status', async () => {
    mockGetRoom.mockRejectedValue(new ChatError('Not found', 404));
    const req = new NextRequest('http://localhost', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetRoom.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
