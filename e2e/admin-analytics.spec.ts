import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Admin Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  });

  test('should access admin analytics page', async ({ page }) => {
    await page.goto('/admin/analytics');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should render analytics dashboard', async ({ page }) => {
    await page.goto('/admin/analytics');
    await page.waitForLoadState('networkidle');

    const pageTitle = page.locator('h1, h2');
    await expect(pageTitle.first()).toBeVisible({ timeout: 5000 });
  });

  test('should not show error state', async ({ page }) => {
    await page.goto('/admin/analytics');
    await page.waitForLoadState('networkidle');

    // Page should not show a 500 or error boundary
    const errorBoundary = page.locator('[data-testid="error-boundary"], .error-boundary');
    const hasError = await errorBoundary.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);
  });
});
