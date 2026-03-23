import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/services/chat', () => ({
  getRoomById: vi.fn(),
  assignAgent: vi.fn(),
  resolveRoom: vi.fn(),
  closeRoom: vi.fn(),
  sendMessage: vi.fn(),
  getMessages: vi.fn(),
  markMessagesAsRead: vi.fn(),
  ChatError: class ChatError extends Error { statusCode: number; constructor(msg: string, code: number) { super(msg); this.statusCode = code; } },
}));
vi.mock('@/validators/chat', () => ({
  adminChatUpdateSchema: { safeParse: vi.fn() },
  sendMessageSchema: { safeParse: vi.fn() },
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET, PATCH, POST } from './route';
import { getRoomById, getMessages, assignAgent, sendMessage, markMessagesAsRead } from '@/services/chat';
import { adminChatUpdateSchema, sendMessageSchema } from '@/validators/chat';

const makeParams = (roomId: string) => ({ params: Promise.resolve({ roomId }), user: { id: 1 } });

describe('GET /api/v1/admin/chat/[roomId]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns room with messages on success', async () => {
    (getRoomById as any).mockResolvedValue({ id: 1 });
    (getMessages as any).mockResolvedValue({ messages: [], total: 0 });

    const req = new NextRequest('http://localhost/api/v1/admin/chat/1');
    const res = await GET(req, makeParams('1'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('room');
    expect(data).toHaveProperty('messages');
  });

  it('returns 400 for invalid ID', async () => {
    const req = new NextRequest('http://localhost/api/v1/admin/chat/abc');
    const res = await GET(req, makeParams('abc'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (getRoomById as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost/api/v1/admin/chat/1');
    const res = await GET(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/v1/admin/chat/[roomId]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('assigns agent on success', async () => {
    (adminChatUpdateSchema.safeParse as any).mockReturnValue({ success: true, data: { action: 'assign' } });
    (assignAgent as any).mockResolvedValue({ id: 1, status: 'assigned' });
    (sendMessage as any).mockResolvedValue({});

    const req = new NextRequest('http://localhost/api/v1/admin/chat/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign' }),
    });
    const res = await PATCH(req, makeParams('1'));

    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new NextRequest('http://localhost/api/v1/admin/chat/0', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign' }),
    });
    const res = await PATCH(req, makeParams('0'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (adminChatUpdateSchema.safeParse as any).mockReturnValue({ success: true, data: { action: 'assign' } });
    (assignAgent as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost/api/v1/admin/chat/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign' }),
    });
    const res = await PATCH(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/chat/[roomId]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sends message on success', async () => {
    (sendMessageSchema.safeParse as any).mockReturnValue({ success: true, data: { content: 'Hello' } });
    (markMessagesAsRead as any).mockResolvedValue(undefined);
    (sendMessage as any).mockResolvedValue({ id: 1, content: 'Hello' });

    const req = new NextRequest('http://localhost/api/v1/admin/chat/1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello' }),
    });
    const res = await POST(req, makeParams('1'));

    expect(res.status).toBe(201);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new NextRequest('http://localhost/api/v1/admin/chat/0', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello' }),
    });
    const res = await POST(req, makeParams('0'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (sendMessageSchema.safeParse as any).mockReturnValue({ success: true, data: { content: 'Hello' } });
    (markMessagesAsRead as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost/api/v1/admin/chat/1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello' }),
    });
    const res = await POST(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});
