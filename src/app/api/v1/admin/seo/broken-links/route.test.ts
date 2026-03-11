import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/jobs/broken-link-checker', () => ({ checkBrokenLinks: vi.fn() }));

import { GET } from './route';
import { checkBrokenLinks } from '@/services/jobs/broken-link-checker';

describe('GET /api/v1/admin/seo/broken-links', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns broken links report on success', async () => {
    vi.mocked(checkBrokenLinks).mockResolvedValue({ broken: [] });
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(checkBrokenLinks).mockRejectedValue(new Error('fail'));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
