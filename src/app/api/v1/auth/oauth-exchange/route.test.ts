import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { POST } from './route';

describe('POST /api/v1/auth/oauth-exchange', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without oauth_access_token cookie', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/oauth-exchange', {
      method: 'POST',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns access token and clears cookie on success', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/oauth-exchange', {
      method: 'POST',
      headers: { cookie: 'oauth_access_token=my-token-value' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.accessToken).toBe('my-token-value');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Set-Cookie')).toContain('oauth_access_token=');
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
});
