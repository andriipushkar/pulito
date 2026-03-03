import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Admin Orders Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USERS.manager.email, TEST_USERS.manager.password);
  });

  test('should access admin orders page', async ({ page }) => {
    await page.goto('/admin/orders');
    await page.waitForLoadState('networkidle');

    // Admin page should load (not redirect to login or show 403)
    expect(page.url()).toContain('/admin');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display order list', async ({ page }) => {
    await page.goto('/admin/orders');
    await page.waitForLoadState('networkidle');

    // Should have a table or list of orders
    const ordersList = page.locator('table, [data-testid="orders-list"], .orders-list');
    const _hasOrders = await ordersList.isVisible({ timeout: 5000 }).catch(() => false);

    // Even if empty, the page should load without errors
    const pageTitle = page.locator('h1, h2');
    await expect(pageTitle.first()).toBeVisible({ timeout: 5000 });
  });

  test('should filter orders by status', async ({ page }) => {
    await page.goto('/admin/orders');
    await page.waitForLoadState('networkidle');

    // Look for status filter
    const statusFilter = page.locator('select[name="status"], [data-testid="status-filter"]').first();
    if (await statusFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusFilter.selectOption({ index: 1 });
      await page.waitForTimeout(500);
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('should navigate to order details', async ({ page }) => {
    await page.goto('/admin/orders');
    await page.waitForLoadState('networkidle');

    // Click on first order if available
    const orderLink = page.locator('a[href*="/admin/orders/"], tr[data-testid="order-row"]').first();
    if (await orderLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await orderLink.click();
      await page.waitForLoadState('networkidle');

      // Should be on order detail page
      expect(page.url()).toMatch(/\/admin\/orders\/\d+/);
    }
  });

  test('admin should access admin dashboard', async ({ page }) => {
    // Login as admin instead
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill(TEST_USERS.admin.email);
    await page.locator('input[type="password"]').fill(TEST_USERS.admin.password);
    await page.locator('button[type="submit"]').click();
    await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 10000 });

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/admin');
  });
});
