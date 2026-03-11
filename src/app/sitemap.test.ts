import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: vi.fn().mockResolvedValue([
        { slug: 'soap-1', updatedAt: new Date('2025-01-01') },
      ]),
    },
    category: {
      findMany: vi.fn().mockResolvedValue([
        { slug: 'cleaning', updatedAt: new Date('2025-01-02') },
      ]),
    },
    staticPage: {
      findMany: vi.fn().mockResolvedValue([
        { slug: 'about', updatedAt: new Date('2025-01-03') },
      ]),
    },
  },
}));

import sitemap from './sitemap';

describe('sitemap', () => {
  it('returns an array containing static and dynamic pages', async () => {
    const result = await sitemap();
    expect(Array.isArray(result)).toBe(true);
    // 3 static + 1 product + 1 category + 1 content = 6
    expect(result.length).toBe(6);
  });

  it('includes product URLs with correct format', async () => {
    const result = await sitemap();
    const productEntry = result.find((e) => e.url.includes('/product/soap-1'));
    expect(productEntry).toBeDefined();
    expect(productEntry!.priority).toBe(0.8);
    expect(productEntry!.changeFrequency).toBe('weekly');
  });

  it('includes category URLs', async () => {
    const result = await sitemap();
    const catEntry = result.find((e) => e.url.includes('category=cleaning'));
    expect(catEntry).toBeDefined();
    expect(catEntry!.priority).toBe(0.7);
  });

  it('includes static content pages', async () => {
    const result = await sitemap();
    const pageEntry = result.find((e) => e.url.includes('/pages/about'));
    expect(pageEntry).toBeDefined();
    expect(pageEntry!.changeFrequency).toBe('monthly');
  });

  it('uses APP_URL env variable for URLs', async () => {
    const origUrl = process.env.APP_URL;
    process.env.APP_URL = 'https://example.com';
    try {
      const result = await sitemap();
      const homeEntry = result.find((e) => e.url === 'https://example.com');
      expect(homeEntry).toBeDefined();
      expect(homeEntry!.priority).toBe(1);
    } finally {
      process.env.APP_URL = origUrl;
    }
  });

  it('falls back to localhost when APP_URL is not set', async () => {
    const origUrl = process.env.APP_URL;
    delete process.env.APP_URL;
    try {
      const result = await sitemap();
      const homeEntry = result.find((e) => e.url === 'http://localhost:3000');
      expect(homeEntry).toBeDefined();
    } finally {
      process.env.APP_URL = origUrl;
    }
  });
});
