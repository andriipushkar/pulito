import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/jobs/digest', () => ({ processDigestEmails: vi.fn() }));

import { POST } from './route';
import { processDigestEmails } from '@/services/jobs/digest';

describe('POST /api/v1/admin/jobs/digest', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('processes digest on success', async () => {
    vi.mocked(processDigestEmails).mockResolvedValue({ sent: 10 });
    const res = await POST();
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(processDigestEmails).mockRejectedValue(new Error('fail'));
    const res = await POST();
    expect(res.status).toBe(500);
  });
});
