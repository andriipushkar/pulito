import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('@/lib/prisma', () => ({
  prisma: {
    slugRedirect: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    category: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { checkBrokenLinks, runBrokenLinkChecker } from './broken-link-checker';

const mockPrisma = prisma as unknown as {
  slugRedirect: { findMany: ReturnType<typeof vi.fn> };
  product: { findMany: ReturnType<typeof vi.fn> };
  category: { findMany: ReturnType<typeof vi.fn> };
};

// Default product/category rows include the fields the service selects so
// downstream loops (images, content, SEO) don't blow up on undefined access.
function makeProduct(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    name: 'Default Product',
    slug: 'default-product',
    content: null,
    images: [],
    ...over,
  } as any;
}

function makeCategory(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    name: 'Default Category',
    slug: 'default-cat',
    seoTitle: null,
    seoDescription: null,
    ...over,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.TELEGRAM_MANAGER_CHAT_ID;
  delete process.env.TELEGRAM_BOT_TOKEN;
});

describe('checkBrokenLinks', () => {
  it('should return empty arrays when no redirects and no SEO gaps', async () => {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([]);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await checkBrokenLinks();
    expect(result.orphanedRedirects).toEqual([]);
    expect(result.redirectChains).toEqual([]);
    expect(result.seoGaps).toEqual([]);
  });

  it('should detect orphaned product redirect when newSlug is not in product set', async () => {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([
      { id: 1, oldSlug: 'old-prod', newSlug: 'missing-prod', type: 'product' },
    ]);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await checkBrokenLinks();
    expect(result.orphanedRedirects).toEqual([
      { id: 1, oldSlug: 'old-prod', newSlug: 'missing-prod', type: 'product' },
    ]);
  });

  it('should not report orphaned redirect when product slug exists', async () => {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([
      { id: 1, oldSlug: 'old-prod', newSlug: 'existing-prod', type: 'product' },
    ]);
    mockPrisma.product.findMany.mockResolvedValue([makeProduct({ slug: 'existing-prod' })]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await checkBrokenLinks();
    expect(result.orphanedRedirects).toEqual([]);
  });

  it('should detect orphaned category redirect when category does not exist', async () => {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([
      { id: 2, oldSlug: 'old-cat', newSlug: 'missing-cat', type: 'category' },
    ]);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await checkBrokenLinks();
    expect(result.orphanedRedirects).toEqual([
      { id: 2, oldSlug: 'old-cat', newSlug: 'missing-cat', type: 'category' },
    ]);
  });

  it('should not report orphaned redirect when category slug exists', async () => {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([
      { id: 2, oldSlug: 'old-cat', newSlug: 'existing-cat', type: 'category' },
    ]);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([makeCategory({ slug: 'existing-cat' })]);

    const result = await checkBrokenLinks();
    expect(result.orphanedRedirects).toEqual([]);
  });

  it('should ignore unknown redirect types (not product/category)', async () => {
    // 'page' type is out of scope for this checker — the loop skips it.
    mockPrisma.slugRedirect.findMany.mockResolvedValue([
      { id: 3, oldSlug: 'old', newSlug: 'new', type: 'page' },
    ]);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await checkBrokenLinks();
    expect(result.orphanedRedirects).toEqual([]);
  });

  it('should detect redirect chains (multi-hop)', async () => {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([
      { id: 1, oldSlug: 'a', newSlug: 'b', type: 'product' },
      { id: 2, oldSlug: 'b', newSlug: 'c', type: 'product' },
    ]);
    // Make 'c' a valid live product so the chain endpoint isn't orphaned.
    mockPrisma.product.findMany.mockResolvedValue([makeProduct({ slug: 'c' })]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await checkBrokenLinks();
    expect(result.redirectChains.length).toBeGreaterThanOrEqual(1);
    expect(result.redirectChains[0]).toMatchObject({
      type: 'product',
      finalSlug: 'c',
    });
  });

  it('should report SEO gap for products with empty title and description', async () => {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([]);
    mockPrisma.product.findMany.mockResolvedValue([
      makeProduct({ id: 10, name: 'No SEO Prod', slug: 'no-seo', content: { seoTitle: '', seoDescription: '', fullDescription: '', shortDescription: '' } }),
    ]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await checkBrokenLinks();
    expect(result.seoGaps).toHaveLength(1);
    expect(result.seoGaps[0]).toMatchObject({
      id: 10,
      name: 'No SEO Prod',
      slug: 'no-seo',
      type: 'product',
      missingTitle: true,
      missingDescription: true,
    });
  });

  it('should report SEO gap for categories with empty title and description', async () => {
    mockPrisma.slugRedirect.findMany.mockResolvedValue([]);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([
      makeCategory({ id: 5, name: 'No SEO Cat', slug: 'no-seo-cat' }),
    ]);

    const result = await checkBrokenLinks();
    expect(result.seoGaps).toHaveLength(1);
    expect(result.seoGaps[0]).toMatchObject({
      id: 5,
      name: 'No SEO Cat',
      slug: 'no-seo-cat',
      type: 'category',
      missingTitle: true,
      missingDescription: true,
    });
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
      { id: 1, oldSlug: 'x', newSlug: 'missing', type: 'product' },
    ]);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await runBrokenLinkChecker();
    expect(result.orphanedRedirects).toHaveLength(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should send telegram notification when issues found and env vars set', async () => {
    process.env.TELEGRAM_MANAGER_CHAT_ID = '123';
    process.env.TELEGRAM_BOT_TOKEN = 'tok';
    mockPrisma.slugRedirect.findMany.mockResolvedValue([
      { id: 1, oldSlug: 'x', newSlug: 'missing', type: 'product' },
    ]);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);
    mockFetch.mockResolvedValue({ ok: true } as any);

    await runBrokenLinkChecker();
    expect(mockFetch).toHaveBeenCalled();
  });
});
