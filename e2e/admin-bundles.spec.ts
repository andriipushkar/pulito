import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Admin Bundles Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  });

  test('should access admin bundles page', async ({ page }) => {
    await page.goto('/admin/bundles');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin/bundles');

    // Should show a heading
    const heading = page.locator('h1, h2');
    await expect(heading.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display bundles table or list', async ({ page }) => {
    await page.goto('/admin/bundles');
    await page.waitForLoadState('networkidle');

    // Should have a table, grid, or empty state
    const table = page.locator('table');
    const list = page.locator('[class*="grid"], [class*="list"]');
    const emptyState = page.locator('text=/Немає комплектів|Комплекти відсутні/i');

    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
    const hasList = await list.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasTable || hasList || hasEmpty).toBeTruthy();
  });

  test('should have create button', async ({ page }) => {
    await page.goto('/admin/bundles');
    await page.waitForLoadState('networkidle');

    // Look for create/add button
    const addButton = page.locator('a[href*="/admin/bundles/new"], button:has-text("Додати"), button:has-text("Створити"), a:has-text("Новий комплект")');
    const hasAddButton = await addButton.first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasAddButton).toBeTruthy();
  });
});
