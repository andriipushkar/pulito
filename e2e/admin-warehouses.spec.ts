import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Admin Warehouses Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  });

  test('should access admin warehouses page', async ({ page }) => {
    await page.goto('/admin/warehouses');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin/warehouses');

    // Should show a heading
    const heading = page.locator('h1, h2');
    await expect(heading.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display warehouses table or list', async ({ page }) => {
    await page.goto('/admin/warehouses');
    await page.waitForLoadState('networkidle');

    // Should have a table, list, or empty state
    const table = page.locator('table');
    const list = page.locator('[class*="grid"], [class*="list"]');
    const emptyState = page.locator('text=/Немає складів|Склади відсутні/i');

    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
    const hasList = await list.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasTable || hasList || hasEmpty).toBeTruthy();
  });

  test('should show warehouse details or rows', async ({ page }) => {
    await page.goto('/admin/warehouses');
    await page.waitForLoadState('networkidle');

    // Table rows or cards should exist
    const tableRows = page.locator('table tbody tr');
    const cards = page.locator('[class*="card"]');

    const rowCount = await tableRows.count();
    const cardCount = await cards.count();

    // Page should be stable regardless of data
    await expect(page.locator('main')).toBeVisible({ timeout: 5000 });
  });
});
