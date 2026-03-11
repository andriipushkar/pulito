import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    botWelcomeMessage: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

import { GET, POST, PUT } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/bot-welcome', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns messages on success', async () => {
    vi.mocked(prisma.botWelcomeMessage.findMany).mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.botWelcomeMessage.findMany).mockRejectedValue(new Error('fail'));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/bot-welcome', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates message on success', async () => {
    vi.mocked(prisma.botWelcomeMessage.create).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ platform: 'telegram', messageText: 'Welcome' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.botWelcomeMessage.create).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ platform: 'telegram', messageText: 'Welcome' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/bot-welcome', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates message on success', async () => {
    vi.mocked(prisma.botWelcomeMessage.update).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ id: 1, messageText: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.botWelcomeMessage.update).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ id: 1, messageText: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(500);
  });
});
