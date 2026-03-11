import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    botAutoReply: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import { GET, POST } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/bot-replies', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns replies on success', async () => {
    vi.mocked(prisma.botAutoReply.findMany).mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.botAutoReply.findMany).mockRejectedValue(new Error('fail'));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/bot-replies', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates reply on success', async () => {
    vi.mocked(prisma.botAutoReply.create).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ responseText: 'Hello' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.botAutoReply.create).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ responseText: 'Hello' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
