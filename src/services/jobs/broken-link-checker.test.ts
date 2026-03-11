import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('@/lib/prisma', () => ({
  prisma: {
    slugRedirect: { findMany: vi.fn() },
    product: { findFirst: vi.fn(), findMany: vi.fn() },
    category: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { checkBrokenLinks, runBrokenLinkChecker } from './broken-link-checker';

const mockPrisma = prisma as unknown as {
  slugRedirect: { findMany: ReturnType<typeof vi.fn> };
  product: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  category: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.TELEGRAM_MANAGER_CHAT_ID;
  delete process.env.TELEGRAM_BOT_TOKEN;
});

describe('checkBrokenLinks', () => {
  it('should return empty report when no redirects and no SEO gaps', async () => {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([]);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await checkBrokenLinks();
    expect(result).toEqual({ orphanedRedirects: [], redirectChains: [], seoGaps: [] });
  });

  it('should detect orphaned product redirect when product does not exist', async () => {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([
      { id: 1, oldSlug: 'old-prod', newSlug: 'missing-prod', type: 'product' },
    ]);
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await checkBrokenLinks();
    expect(result.orphanedRedirects).toEqual([
      { id: 1, oldSlug: 'old-prod', newSlug: 'missing-prod', type: 'product' },
    ]);
  });

  it('should not report orphaned redirect when product exists', async () => {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([
      { id: 1, oldSlug: 'old-prod', newSlug: 'existing-prod', type: 'product' },
    ]);
    mockPrisma.product.findFirst.mockResolvedValue({ id: 10 });
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await checkBrokenLinks();
    expect(result.orphanedRedirects).toEqual([]);
  });

  it('should detect orphaned category redirect when category does not exist', async () => {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([
      { id: 2, oldSlug: 'old-cat', newSlug: 'missing-cat', type: 'category' },
    ]);
    mockPrisma.category.findFirst.mockResolvedValue(null);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await checkBrokenLinks();
    expect(result.orphanedRedirects).toEqual([
      { id: 2, oldSlug: 'old-cat', newSlug: 'missing-cat', type: 'category' },
    ]);
  });

  it('should not report orphaned redirect when category exists', async () => {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([
      { id: 2, oldSlug: 'old-cat', newSlug: 'existing-cat', type: 'category' },
    ]);
    mockPrisma.category.findFirst.mockResolvedValue({ id: 5 });
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await checkBrokenLinks();
    expect(result.orphanedRedirects).toEqual([]);
  });

  it('should handle unknown redirect type (not product/category) — exists stays false', async () => {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([
      { id: 3, oldSlug: 'old', newSlug: 'new', type: 'page' },
    ]);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await checkBrokenLinks();
    expect(result.orphanedRedirects).toEqual([
      { id: 3, oldSlug: 'old', newSlug: 'new', type: 'page' },
    ]);
  });

  it('should detect redirect chains', async () => {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([
      { id: 1, oldSlug: 'a', newSlug: 'b', type: 'product' },
      { id: 2, oldSlug: 'b', newSlug: 'c', type: 'product' },
    ]);
    mockPrisma.product.findFirst.mockResolvedValue({ id: 1 });
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await checkBrokenLinks();
    expect(result.redirectChains).toEqual([
      { id: 1, oldSlug: 'a', newSlug: 'b', type: 'product', finalSlug: 'c' },
    ]);
  });

  it('should find products without SEO content', async () => {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([]);
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 10, name: 'No SEO Prod', slug: 'no-seo' },
    ]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await checkBrokenLinks();
    expect(result.seoGaps).toEqual([
      { id: 10, name: 'No SEO Prod', slug: 'no-seo', type: 'product' },
    ]);
  });

  it('should find categories without SEO content', async () => {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([]);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([
      { id: 5, name: 'No SEO Cat', slug: 'no-seo-cat' },
    ]);

    const result = await checkBrokenLinks();
    expect(result.seoGaps).toEqual([
      { id: 5, name: 'No SEO Cat', slug: 'no-seo-cat', type: 'category' },
    ]);
  });
});

describe('runBrokenLinkChecker', () => {
  function setupNoIssues() {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([]);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);
  }

  it('should return report without sending notification when no issues', async () => {
    setupNoIssues();
    const result = await runBrokenLinkChecker();
    expect(result.orphanedRedirects).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return report without notification when env vars are missing', async () => {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([
      { id: 1, oldSlug: 'a', newSlug: 'b', type: 'product' },
    ]);
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await runBrokenLinkChecker();
    expect(result.orphanedRedirects.length).toBe(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return report without notification when chatId missing', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'bot123';
    // No TELEGRAM_MANAGER_CHAT_ID
    mockPrisma.slugRedirect.findMany.mockResolvedValue([
      { id: 1, oldSlug: 'a', newSlug: 'b', type: 'product' },
    ]);
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await runBrokenLinkChecker();
    expect(result.orphanedRedirects.length).toBe(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should send telegram notification when issues found and env vars set', async () => {
    process.env.TELEGRAM_MANAGER_CHAT_ID = '12345';
    process.env.TELEGRAM_BOT_TOKEN = 'bot123';

    mockPrisma.slugRedirect.findMany.mockResolvedValue([
      { id: 1, oldSlug: 'a', newSlug: 'b', type: 'product' },
    ]);
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 10, name: 'Prod', slug: 'prod' },
    ]);
    mockPrisma.category.findMany.mockResolvedValue([]);
    mockFetch.mockResolvedValue({ ok: true });

    const result = await runBrokenLinkChecker();

    expect(result.orphanedRedirects.length).toBe(1);
    expect(result.seoGaps.length).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[0]).toContain('bot123/sendMessage');
    const body = JSON.parse(fetchCall[1].body);
    expect(body.chat_id).toBe(12345);
    expect(body.text).toContain('Битих редіректів: 1');
    expect(body.text).toContain('Без SEO-контенту: 1');
  });

  it('should include redirect chains in notification', async () => {
    process.env.TELEGRAM_MANAGER_CHAT_ID = '12345';
    process.env.TELEGRAM_BOT_TOKEN = 'bot123';

    mockPrisma.slugRedirect.findMany.mockResolvedValue([
      { id: 1, oldSlug: 'a', newSlug: 'b', type: 'product' },
      { id: 2, oldSlug: 'b', newSlug: 'c', type: 'product' },
    ]);
    mockPrisma.product.findFirst.mockResolvedValue({ id: 1 });
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);
    mockFetch.mockResolvedValue({ ok: true });

    const result = await runBrokenLinkChecker();

    expect(result.redirectChains.length).toBe(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('Ланцюгів редіректів: 1');
  });

  it('should handle telegram fetch error gracefully', async () => {
    process.env.TELEGRAM_MANAGER_CHAT_ID = '12345';
    process.env.TELEGRAM_BOT_TOKEN = 'bot123';

    mockPrisma.slugRedirect.findMany.mockResolvedValue([
      { id: 1, oldSlug: 'a', newSlug: 'missing', type: 'product' },
    ]);
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await runBrokenLinkChecker();
    // Should still return the report
    expect(result.orphanedRedirects.length).toBe(1);
  });

  it('should only show first 5 items per section in notification', async () => {
    process.env.TELEGRAM_MANAGER_CHAT_ID = '12345';
    process.env.TELEGRAM_BOT_TOKEN = 'bot123';

    const redirects = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      oldSlug: `old-${i}`,
      newSlug: `new-${i}`,
      type: 'product',
    }));
    mockPrisma.slugRedirect.findMany.mockResolvedValue(redirects);
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);
    mockFetch.mockResolvedValue({ ok: true });

    await runBrokenLinkChecker();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    // Should list max 5 orphaned redirects in notification
    const bulletCount = (body.text.match(/old-/g) || []).length;
    expect(bulletCount).toBe(5);
  });
});
