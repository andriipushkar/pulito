import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/seo-template', () => ({
  bulkGenerateProductSeo: vi.fn(),
  SeoTemplateError: class SeoTemplateError extends Error { statusCode = 400; },
}));

import { POST } from './route';
import { bulkGenerateProductSeo } from '@/services/seo-template';

describe('POST /api/v1/admin/seo-templates/generate', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('generates SEO on success', async () => {
    vi.mocked(bulkGenerateProductSeo).mockResolvedValue({ updated: 10 });
    const res = await POST();
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(bulkGenerateProductSeo).mockRejectedValue(new Error('fail'));
    const res = await POST();
    expect(res.status).toBe(500);
  });

  it('returns SeoTemplateError status on SeoTemplateError', async () => {
    const { SeoTemplateError } = await import('@/services/seo-template');
    vi.mocked(bulkGenerateProductSeo).mockRejectedValue(new SeoTemplateError('no templates'));
    const res = await POST();
    expect(res.status).toBe(400);
  });
});
