import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    APP_URL: 'https://test.com',
    CRON_SECRET: 'test-cron-secret',
    APP_SECRET: 'test-app-secret',
  },
}));
vi.mock('@/middleware/auth', () => ({
  withRole:
    (..._roles: string[]) =>
    (handler: any) =>
      handler,
  withRole2fa:
    (..._roles: string[]) =>
    (handler: any) =>
      handler,
}));
vi.mock('@/services/channel-config', () => ({
  getAllChannelConfigs: vi.fn(),
  maskChannelConfig: vi.fn(),
  saveChannelConfig: vi.fn(),
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET, PUT } from './route';
import {
  getAllChannelConfigs,
  maskChannelConfig,
  saveChannelConfig,
} from '@/services/channel-config';

describe('GET /api/v1/admin/channel-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns masked channel configs on success', async () => {
    (getAllChannelConfigs as any).mockResolvedValue({});
    (maskChannelConfig as any).mockReturnValue({ enabled: false });

    const res = await (GET as any)();

    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    (getAllChannelConfigs as any).mockRejectedValue(new Error('fail'));

    const res = await (GET as any)();

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/channel-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves channel config on success', async () => {
    (saveChannelConfig as any).mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'telegram',
        config: { enabled: true, botToken: 'tok', channelId: 'ch' },
      }),
    });
    const res = await (PUT as any)(req, { user: { id: 1, email: 't@t', role: 'admin' } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.saved).toBe(true);
  });

  it('returns error for unknown channel', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'unknown', config: {} }),
    });
    const res = await (PUT as any)(req, { user: { id: 1, email: 't@t', role: 'admin' } });

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (saveChannelConfig as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'telegram',
        config: { enabled: true, botToken: 'tok', channelId: 'ch' },
      }),
    });
    const res = await (PUT as any)(req, { user: { id: 1, email: 't@t', role: 'admin' } });

    expect(res.status).toBe(500);
  });
});
