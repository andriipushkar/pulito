import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/services/jobs/email-campaigns', () => ({
  processWelcomeEmails: vi.fn(),
  processWeeklyDigest: vi.fn(),
}));

import { POST } from './route';
import { processWelcomeEmails, processWeeklyDigest } from '@/services/jobs/email-campaigns';

describe('POST /api/v1/cron/email-campaigns', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 without valid authorization', async () => {
    const req = new NextRequest('http://localhost', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('processes welcome emails by default', async () => {
    vi.mocked(processWelcomeEmails).mockResolvedValue({ sent: 10 } as any);
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(processWelcomeEmails).toHaveBeenCalled();
  });

  it('processes weekly digest when type=digest', async () => {
    vi.mocked(processWeeklyDigest).mockResolvedValue({ sent: 5 } as any);
    const req = new NextRequest('http://localhost?type=digest', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(processWeeklyDigest).toHaveBeenCalled();
  });

  it('returns 400 for unknown type', async () => {
    const req = new NextRequest('http://localhost?type=unknown', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(processWelcomeEmails).mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
