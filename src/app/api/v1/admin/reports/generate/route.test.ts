import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/report-generator', () => ({ generateReport: vi.fn() }));

import { POST } from './route';
import { generateReport } from '@/services/report-generator';

describe('POST /api/v1/admin/reports/generate', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('generates report on success', async () => {
    vi.mocked(generateReport).mockResolvedValue({ url: '/reports/test.xlsx' });
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ templateKey: 'sales_summary', format: 'xlsx' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(generateReport).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ templateKey: 'sales_summary', format: 'xlsx' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 on validation failure', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ templateKey: 'invalid_key', format: 'xlsx' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});
