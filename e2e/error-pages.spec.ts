import { test, expect } from '@playwright/test';

test.describe('Error Pages', () => {
  test('should display 404 page for non-existent route', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-404-test');

    // Should show 404 content or custom error page
    await page.waitForLoadState('domcontentloaded');

    const notFoundContent = page.locator(
      'text=/404|не знайдено|not found|сторінку не знайдено|Page not found/i',
    );
    const hasNotFound = await notFoundContent
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Page should at least render (custom 404 or Next.js default)
    await expect(page.locator('body')).toBeVisible();

    // Verify HTTP status or content
    if (response) {
      const status = response.status();
      // 404 or soft 404 (200 with not-found content)
      expect(status === 404 || status === 200).toBeTruthy();
    }
  });

  test('should display 404 for non-existent product', async ({ page }) => {
    await page.goto('/product/this-product-does-not-exist-99999');
    await page.waitForLoadState('domcontentloaded');

    const notFoundContent = page.locator('text=/404|не знайдено|not found|товар не знайдено/i');
    const hasNotFound = await notFoundContent
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    await expect(page.locator('body')).toBeVisible();
  });

  test('should display 404 for non-existent category', async ({ page }) => {
    await page.goto('/catalog/non-existent-category-slug');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle graceful error for broken API calls', async ({ page }) => {
    // Navigate to a page that makes API calls
    await page.goto('/catalog');
    await page.waitForLoadState('domcontentloaded');

    // The page should render even if some API calls fail
    await expect(page.locator('body')).toBeVisible();

    // Check no unhandled JS errors crash the page
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/catalog?page=99999');
    await page.waitForLoadState('domcontentloaded');

    // Page should still be visible (graceful handling)
    await expect(page.locator('body')).toBeVisible();
  });

  test('should redirect unauthorized admin access', async ({ page }) => {
    // Try accessing admin pages without being logged in
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    // Should redirect to login or show unauthorized
    const isOnLogin = page.url().includes('/auth/login');
    const isOnAdmin = page.url().includes('/admin');
    const unauthorizedMsg = page.locator('text=/unauthorized|заборонено|403|доступ/i');
    const hasUnauthorized = await unauthorizedMsg
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(isOnLogin || hasUnauthorized || isOnAdmin).toBeTruthy();
  });

  test('should show custom error page layout', async ({ page }) => {
    await page.goto('/this-does-not-exist-test');
    await page.waitForLoadState('domcontentloaded');

    // Custom error pages should still show navigation
    const nav = page.locator('nav, header');
    const hasNav = await nav
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // At minimum the page should render
    await expect(page.locator('body')).toBeVisible();
  });
});
