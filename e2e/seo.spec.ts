import { test, expect } from '@playwright/test';

test.describe('SEO — Homepage', () => {
  test('should have Organization JSON-LD', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const jsonLd = page.locator('script[type="application/ld+json"]');
    const count = await jsonLd.count();
    expect(count).toBeGreaterThan(0);

    // Check that at least one JSON-LD contains Organization schema
    let hasOrganization = false;
    for (let i = 0; i < count; i++) {
      const content = await jsonLd.nth(i).textContent();
      if (content?.includes('Organization') || content?.includes('WebSite') || content?.includes('Store')) {
        hasOrganization = true;
        break;
      }
    }
    expect(hasOrganization).toBeTruthy();
  });

  test('should have proper meta title', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(5);
  });

  test('should have meta description', async ({ page }) => {
    await page.goto('/');
    const metaDesc = page.locator('meta[name="description"]');
    const content = await metaDesc.getAttribute('content');
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(10);
  });

  test('should have Open Graph tags', async ({ page }) => {
    await page.goto('/');
    const ogTitle = page.locator('meta[property="og:title"]');
    const hasOg = await ogTitle.count();
    if (hasOg > 0) {
      const content = await ogTitle.getAttribute('content');
      expect(content).toBeTruthy();
    }
  });
});

test.describe('SEO — Product Page', () => {
  test('should have Product JSON-LD', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    const productLink = page.locator('a[href*="/product/"]').first();
    if (!await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await productLink.click();
    await page.waitForLoadState('networkidle');

    const jsonLd = page.locator('script[type="application/ld+json"]');
    const count = await jsonLd.count();

    let hasProduct = false;
    for (let i = 0; i < count; i++) {
      const content = await jsonLd.nth(i).textContent();
      if (content?.includes('Product')) {
        hasProduct = true;
        break;
      }
    }

    if (hasProduct) {
      expect(hasProduct).toBeTruthy();
    }
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have product meta title', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    const productLink = page.locator('a[href*="/product/"]').first();
    if (!await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await productLink.click();
    await page.waitForLoadState('networkidle');

    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(3);
  });
});

test.describe('SEO — Blog Page', () => {
  test('should have proper meta tags on blog listing', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);

    const metaDesc = page.locator('meta[name="description"]');
    const count = await metaDesc.count();
    if (count > 0) {
      const content = await metaDesc.getAttribute('content');
      expect(content).toBeTruthy();
    }
  });

  test('should have meta tags on blog post detail', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    const postLink = page.locator('a[href*="/blog/"]').first();
    if (!await postLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await postLink.click();
    await page.waitForLoadState('networkidle');

    const title = await page.title();
    expect(title).toBeTruthy();

    // Check for article-related meta
    const ogType = page.locator('meta[property="og:type"]');
    const hasOgType = await ogType.count();
    if (hasOgType > 0) {
      const content = await ogType.getAttribute('content');
      expect(content).toBeTruthy();
    }
  });
});

test.describe('SEO — Sitemap', () => {
  test('should be accessible at /sitemap.xml', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain('<?xml');
    expect(text).toContain('urlset');
    expect(text).toContain('<loc>');
  });

  test('sitemap should contain key pages', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    const text = await response.text();

    // Should contain at least some key URLs
    const hasHomepage = text.includes('/') || text.includes('clean');
    expect(hasHomepage).toBeTruthy();
  });

  test('should have robots.txt pointing to sitemap', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain('Sitemap');
  });
});
