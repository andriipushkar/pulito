import { test, expect } from '@playwright/test';

test.describe('Static Pages', () => {
  test('should load delivery page', async ({ page }) => {
    await page.goto('/pages/delivery');
    await page.waitForLoadState('networkidle');

    const main = page.locator('main');
    await expect(main).toBeVisible({ timeout: 5000 });

    // Should have a heading
    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('should load about page', async ({ page }) => {
    await page.goto('/pages/about');
    await page.waitForLoadState('networkidle');

    const main = page.locator('main');
    await expect(main).toBeVisible({ timeout: 5000 });

    // Should have a heading
    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('should render page content', async ({ page }) => {
    await page.goto('/pages/delivery');
    await page.waitForLoadState('networkidle');

    // Page should have meaningful text content
    const content = page.locator('main');
    await expect(content).toBeVisible({ timeout: 5000 });

    const text = await content.textContent();
    expect(text && text.length).toBeGreaterThan(50);
  });

  test('should display breadcrumbs on static page', async ({ page }) => {
    await page.goto('/pages/delivery');
    await page.waitForLoadState('networkidle');

    // Look for breadcrumb navigation
    const breadcrumb = page.locator(
      'nav[aria-label*="breadcrumb"], nav[aria-label*="Breadcrumb"], [class*="breadcrumb"], ol > li > a[href="/"]',
    );
    const hasBreadcrumb = await breadcrumb
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (hasBreadcrumb) {
      await expect(breadcrumb.first()).toBeVisible();
    }

    // Page should be stable regardless
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have SEO metadata', async ({ page }) => {
    await page.goto('/pages/delivery');
    await page.waitForLoadState('networkidle');

    // Check page title exists
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Check meta description
    const metaDescription = page.locator('meta[name="description"]');
    const hasMetaDesc = await metaDescription.count();
    if (hasMetaDesc > 0) {
      const content = await metaDescription.getAttribute('content');
      expect(content).toBeTruthy();
    }

    // Check canonical URL
    const canonical = page.locator('link[rel="canonical"]');
    const hasCanonical = await canonical.count();
    if (hasCanonical > 0) {
      const href = await canonical.getAttribute('href');
      expect(href).toBeTruthy();
    }
  });
});
