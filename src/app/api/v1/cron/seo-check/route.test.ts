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
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
    category: { findMany: vi.fn() },
    siteSetting: { upsert: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
    slugRedirect: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock('@/services/jobs/broken-link-checker', () => ({
  runBrokenLinkChecker: vi.fn().mockResolvedValue({
    orphanedRedirects: [],
    redirectChains: [],
    seoGaps: [],
    seoGapsTotal: 0,
    duplicateTitles: [],
    imageGaps: [],
    imageGapsTotal: 0,
    thinContent: [],
    thinContentTotal: 0,
    slugIssues: [],
    slugIssuesTotal: 0,
    generatedAt: new Date().toISOString(),
  }),
}));

// withCronLock wraps doSeoCheck — run the inner fn directly and report the
// lock as acquired so the audit logic under test actually executes.
vi.mock('@/lib/cron-lock', () => ({
  withCronLock: async (_name: string, _ttl: number, fn: () => Promise<unknown>) => ({
    acquired: true,
    result: await fn(),
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { POST } from './route';
import { prisma } from '@/lib/prisma';

// Route prefers CRON_SECRET over APP_SECRET, so authenticate with that.
const authHeaders = { Authorization: 'Bearer test-cron-secret' };

describe('POST /api/v1/cron/seo-check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ status: 200, ok: true });
    vi.mocked(prisma.siteSetting.upsert).mockResolvedValue({} as any);
    vi.mocked(prisma.siteSetting.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    vi.mocked(prisma.category.findMany).mockResolvedValue([]);
  });

  it('returns 401 without valid authorization', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 200 and counts from runBrokenLinkChecker on auth success', async () => {
    const req = new Request('http://localhost', { method: 'POST', headers: authHeaders });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    // New response shape exposes per-category counts pulled from the scan.
    expect(json.data).toMatchObject({
      orphanedRedirects: 0,
      redirectChains: 0,
      seoGaps: 0,
      duplicateTitles: 0,
      imageGaps: 0,
      thinContent: 0,
      slugIssues: 0,
      productsSampled: 0,
      categoriesChecked: 0,
    });
  });

  it('persists scan result + history via siteSetting.upsert', async () => {
    const req = new Request('http://localhost', { method: 'POST', headers: authHeaders });
    await POST(req as any);
    // One upsert for current results, one for rolling history snapshot.
    expect(prisma.siteSetting.upsert).toHaveBeenCalledTimes(2);
  });

  it('runs HTTP head-check for each visible product + category', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { slug: 'a', name: 'A' } as any,
      { slug: 'b', name: 'B' } as any,
    ]);
    vi.mocked(prisma.category.findMany).mockResolvedValue([{ slug: 'c', name: 'C' } as any]);
    const req = new Request('http://localhost', { method: 'POST', headers: authHeaders });
    await POST(req as any);
    // 2 products head + 1 category head + 2 canonical fetches for sampled products
    expect(mockFetch).toHaveBeenCalled();
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('returns 500 on top-level error', async () => {
    vi.mocked(prisma.product.findMany).mockRejectedValue(new Error('db error'));
    const req = new Request('http://localhost', { method: 'POST', headers: authHeaders });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
