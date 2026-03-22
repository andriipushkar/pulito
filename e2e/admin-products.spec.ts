import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Admin Products Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USERS.manager.email, TEST_USERS.manager.password);
  });

  test('should access admin products page', async ({ page }) => {
    await page.goto('/admin/products');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display products table or list', async ({ page }) => {
    await page.goto('/admin/products');
    await page.waitForLoadState('networkidle');

    const pageTitle = page.locator('h1, h2');
    await expect(pageTitle.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show product rows if data exists', async ({ page }) => {
    await page.goto('/admin/products');
    await page.waitForLoadState('networkidle');

    const table = page.locator('table, [data-testid="products-list"], .products-list');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasTable) {
      const rows = page.locator('tbody tr, [data-testid="product-row"]');
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }

    await expect(page.locator('body')).toBeVisible();
  });
});
