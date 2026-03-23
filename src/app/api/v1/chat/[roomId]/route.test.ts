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
    getRoomById: vi.fn(),
    sendMessage: vi.fn(),
    getMessages: vi.fn(),
    ChatError,
  };
});

vi.mock('@/validators/chat', () => ({
  sendMessageSchema: { safeParse: vi.fn() },
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { GET, POST } from './route';
import { getRoomById, sendMessage, getMessages, ChatError } from '@/services/chat';
import { sendMessageSchema } from '@/validators/chat';

const mockGetRoom = getRoomById as ReturnType<typeof vi.fn>;
const mockSendMsg = sendMessage as ReturnType<typeof vi.fn>;
const mockGetMsgs = getMessages as ReturnType<typeof vi.fn>;
const mockSafeParse = sendMessageSchema.safeParse as ReturnType<typeof vi.fn>;

const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ roomId: '5' }) };
const invalidCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ roomId: 'abc' }) };

describe('GET /api/v1/chat/[roomId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for invalid roomId', async () => {
    const req = new NextRequest('http://localhost/api/v1/chat/abc');
    const res = await GET(req, invalidCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 403 if user does not own room', async () => {
    mockGetRoom.mockResolvedValue({ id: 5, userId: 99, status: 'open', subject: 'test', assignedAgent: null, createdAt: new Date() });
    const req = new NextRequest('http://localhost/api/v1/chat/5?page=1&limit=50');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(403);
  });

  it('returns messages on success', async () => {
    mockGetRoom.mockResolvedValue({ id: 5, userId: 1, status: 'open', subject: 'test', assignedAgent: null, createdAt: new Date() });
    mockGetMsgs.mockResolvedValue({ messages: [{ id: 1, content: 'hi' }], total: 1 });
    const req = new NextRequest('http://localhost/api/v1/chat/5?page=1&limit=50');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns ChatError status', async () => {
    mockGetRoom.mockRejectedValue(new ChatError('Not found', 404));
    const req = new NextRequest('http://localhost/api/v1/chat/5');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetRoom.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/chat/5');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/chat/[roomId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for invalid roomId', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hi' }),
    });
    const res = await POST(req, invalidCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 403 if user does not own room', async () => {
    mockGetRoom.mockResolvedValue({ id: 5, userId: 99, status: 'open' });
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hi' }),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(403);
  });

  it('returns 400 if chat is closed', async () => {
    mockGetRoom.mockResolvedValue({ id: 5, userId: 1, status: 'closed' });
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hi' }),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('sends message on success', async () => {
    mockGetRoom.mockResolvedValue({ id: 5, userId: 1, status: 'open' });
    mockSafeParse.mockReturnValue({ success: true, data: { content: 'hello' } });
    mockSendMsg.mockResolvedValue({ id: 1, content: 'hello' });
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hello' }),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetRoom.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hi' }),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
