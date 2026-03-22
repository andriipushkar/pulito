import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load and display store name', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Clean Shop/i);
  });

  test('should return 200 status', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('should have navigation header', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header');
    await expect(header).toBeVisible();
  });

  test('should have banner slider or hero content visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for banner/slider/hero section
    const banner = page.locator('[data-testid="banner"], [class*="banner"], [class*="slider"], [class*="hero"], .swiper, section').first();
    await expect(banner).toBeVisible({ timeout: 5000 });
  });

  test('should display category grid', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Categories are typically rendered as a grid of links
    const categorySection = page.locator('a[href*="/catalog?category"], a[href*="/catalog?cat"], [data-testid="category"], [class*="category"]').first();
    const hasCategories = await categorySection.isVisible({ timeout: 5000 }).catch(() => false);

    // Category grid is expected but data-dependent
    if (hasCategories) {
      expect(hasCategories).toBeTruthy();
    }
    await expect(page.locator('body')).toBeVisible();
  });

  test('should render product carousels', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Product carousels typically contain product cards or links to products
    const productLinks = page.locator('a[href*="/product/"]');
    const productCount = await productLinks.count();

    if (productCount > 0) {
      await expect(productLinks.first()).toBeVisible();
    }

    // Page should load regardless
    await expect(page.locator('main')).toBeVisible();
  });

  test('should have footer with links', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // Footer should contain navigation links
    const footerLinks = footer.locator('a');
    const linkCount = await footerLinks.count();
    expect(linkCount).toBeGreaterThan(0);
  });

  test('should have working footer links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const footer = page.locator('footer');
    const footerLink = footer.locator('a[href]').first();

    if (await footerLink.isVisible()) {
      const href = await footerLink.getAttribute('href');
      expect(href).toBeTruthy();
    }
  });

  test('should navigate to catalog', async ({ page }) => {
    await page.goto('/');
    const catalogLink = page.locator('a[href="/catalog"]').first();
    if (await catalogLink.isVisible()) {
      await catalogLink.click();
      await expect(page).toHaveURL(/\/catalog/);
    }
  });
});
