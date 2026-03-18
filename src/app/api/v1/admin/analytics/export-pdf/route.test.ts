import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/analytics-pdf', () => ({ generateAnalyticsPdf: vi.fn() }));

import { POST } from './route';
import { generateAnalyticsPdf } from '@/services/analytics-pdf';

describe('POST /api/v1/admin/analytics/export-pdf', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('generates PDF on success', async () => {
    vi.mocked(generateAnalyticsPdf).mockResolvedValue('/reports/test.pdf');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ reportType: 'stock', days: 30 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(generateAnalyticsPdf).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ reportType: 'stock', days: 30 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 on invalid report type', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ reportType: 'invalid_type', days: 30 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});
