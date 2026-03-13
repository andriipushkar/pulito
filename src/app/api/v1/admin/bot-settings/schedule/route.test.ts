import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    siteSetting: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

import { GET, PUT } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/bot-settings/schedule', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns defaults when no setting exists', async () => {
    vi.mocked(prisma.siteSetting.findUnique).mockResolvedValue(null);
    const res = await (GET as any)();
    expect(res.status).toBe(200);
  });

  it('returns saved schedule when setting exists', async () => {
    vi.mocked(prisma.siteSetting.findUnique).mockResolvedValue({
      key: 'bot_schedule',
      value: JSON.stringify({ enabled: true, startHour: 8, endHour: 20, timezone: 'Europe/Kyiv' }),
    } as any);
    const res = await (GET as any)();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.enabled).toBe(true);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.siteSetting.findUnique).mockRejectedValue(new Error('fail'));
    const res = await (GET as any)();
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/bot-settings/schedule', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates schedule on success', async () => {
    vi.mocked(prisma.siteSetting.upsert).mockResolvedValue({} as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ enabled: true, startHour: 9, endHour: 18, timezone: 'Europe/Kyiv' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 422 on validation error', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ enabled: 'not-boolean' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(422);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.siteSetting.upsert).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ enabled: true, startHour: 9, endHour: 18, timezone: 'Europe/Kyiv' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(500);
  });
});
