import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    chatRoom: { findUnique: vi.fn() },
    chatMessage: { findMany: vi.fn() },
  },
}));

vi.mock('@/services/token', () => ({
  verifyAccessToken: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/services/token';
import { GET } from './route';

const mockPrisma = prisma as unknown as {
  chatRoom: { findUnique: ReturnType<typeof vi.fn> };
  chatMessage: { findMany: ReturnType<typeof vi.fn> };
};
const mockVerify = verifyAccessToken as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function createRequest(roomId: string, token?: string) {
  const url = `http://localhost/api/v1/chat/${roomId}/stream${token ? `?token=${token}` : ''}`;
  return new NextRequest(url);
}

describe('GET /api/v1/chat/[roomId]/stream', () => {
  it('returns 401 without token', async () => {
    const res = await GET(createRequest('1'), { params: Promise.resolve({ roomId: '1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    mockVerify.mockImplementation(() => {
      throw new Error('Invalid');
    });
    const res = await GET(createRequest('1', 'bad'), { params: Promise.resolve({ roomId: '1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid room ID', async () => {
    mockVerify.mockReturnValue({ sub: 1, role: 'customer' });
    const res = await GET(createRequest('abc', 'tok'), {
      params: Promise.resolve({ roomId: 'abc' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when room not found', async () => {
    mockVerify.mockReturnValue({ sub: 1, role: 'customer' });
    mockPrisma.chatRoom.findUnique.mockResolvedValue(null);
    const res = await GET(createRequest('99', 'tok'), {
      params: Promise.resolve({ roomId: '99' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 403 when user has no access to room', async () => {
    mockVerify.mockReturnValue({ sub: 5, role: 'customer' });
    mockPrisma.chatRoom.findUnique.mockResolvedValue({ userId: 1, assignedAgentId: 2 });
    const res = await GET(createRequest('1', 'tok'), { params: Promise.resolve({ roomId: '1' }) });
    expect(res.status).toBe(403);
  });

  it('returns SSE stream for room owner', async () => {
    mockVerify.mockReturnValue({ sub: 1, role: 'customer' });
    mockPrisma.chatRoom.findUnique.mockResolvedValue({ userId: 1, assignedAgentId: null });
    mockPrisma.chatMessage.findMany.mockResolvedValue([]);

    const res = await GET(createRequest('1', 'tok'), { params: Promise.resolve({ roomId: '1' }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform');
  });

  it('returns SSE stream for admin regardless of room ownership', async () => {
    mockVerify.mockReturnValue({ sub: 99, role: 'admin' });
    mockPrisma.chatRoom.findUnique.mockResolvedValue({ userId: 1, assignedAgentId: 2 });
    mockPrisma.chatMessage.findMany.mockResolvedValue([]);

    const res = await GET(createRequest('1', 'tok'), { params: Promise.resolve({ roomId: '1' }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
  });
});
