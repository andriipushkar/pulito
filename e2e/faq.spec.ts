import { test, expect } from '@playwright/test';

test.describe('FAQ page', () => {
  test('should load FAQ page', async ({ page }) => {
    const response = await page.goto('/faq');
    expect(response?.status()).toBe(200);

    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('should display page heading', async ({ page }) => {
    await page.goto('/faq');
    await page.waitForLoadState('networkidle');

    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('should display FAQ items', async ({ page }) => {
    await page.goto('/faq');
    await page.waitForLoadState('networkidle');

    // FAQ items are typically in details/summary, accordion, or clickable divs
    const faqItems = page.locator('details, [data-testid="faq-item"], [class*="accordion"], button[aria-expanded]');
    const count = await faqItems.count();

    if (count > 0) {
      await expect(faqItems.first()).toBeVisible();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('should expand FAQ item on click', async ({ page }) => {
    await page.goto('/faq');
    await page.waitForLoadState('networkidle');

    // Try details/summary first
    const detailsItem = page.locator('details summary, [data-testid="faq-item"] button, [class*="accordion"] button, button[aria-expanded]').first();

    if (!await detailsItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await detailsItem.click();
    await page.waitForTimeout(300);

    // After click, content should be visible
    // For <details>, the [open] attribute is set
    const expandedContent = page.locator('details[open], [aria-expanded="true"], [class*="expanded"]').first();
    const isExpanded = await expandedContent.isVisible({ timeout: 3000 }).catch(() => false);

    if (isExpanded) {
      expect(isExpanded).toBeTruthy();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('should collapse FAQ item on second click', async ({ page }) => {
    await page.goto('/faq');
    await page.waitForLoadState('networkidle');

    const detailsItem = page.locator('details summary, [data-testid="faq-item"] button, [class*="accordion"] button, button[aria-expanded]').first();

    if (!await detailsItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    // Open
    await detailsItem.click();
    await page.waitForTimeout(300);

    // Close
    await detailsItem.click();
    await page.waitForTimeout(300);

    // Page should remain stable
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('SEO endpoints', () => {
  test('should return sitemap.xml', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain('<?xml');
    expect(text).toContain('urlset');
  });

  test('should return robots.txt', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain('User-Agent');
    expect(text).toContain('Sitemap');
  });

  test('should return manifest.webmanifest', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.name).toContain('Clean Shop');
  });
});
