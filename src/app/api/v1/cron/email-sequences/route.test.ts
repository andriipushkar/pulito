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
vi.mock('@/services/email-sequences', () => ({
  processWelcomeSeries: vi.fn(),
  processWinBack: vi.fn(),
  processPostPurchaseReviewRequest: vi.fn(),
}));

import { POST } from './route';
import { processWelcomeSeries, processPostPurchaseReviewRequest } from '@/services/email-sequences';

describe('POST /api/v1/cron/email-sequences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without valid authorization', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('processes all email sequences on success', async () => {
    vi.mocked(processWelcomeSeries).mockResolvedValue({ sent: 3 } as any);
    vi.mocked(processPostPurchaseReviewRequest).mockResolvedValue({ sent: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.welcome).toEqual({ sent: 3 });
    expect(data.data.reviewRequest).toEqual({ sent: 1 });
  });

  it('handles partial failures with Promise.allSettled', async () => {
    vi.mocked(processWelcomeSeries).mockResolvedValue({ sent: 3 } as any);
    vi.mocked(processPostPurchaseReviewRequest).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.welcome).toEqual({ sent: 3 });
    expect(data.data.reviewRequest).toEqual({ error: 'failed' });
  });

  it('returns 500 on top-level error', async () => {
    // Simulate error before Promise.allSettled (e.g., auth parsing throws)
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-app-secret' },
    });
    // Force a top-level throw by making all three reject in a way that breaks
    vi.mocked(processWelcomeSeries).mockImplementation(() => {
      throw new Error('sync error');
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
