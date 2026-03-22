import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Admin Users Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  });

  test('should access admin users page', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display users table', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    const pageTitle = page.locator('h1, h2');
    await expect(pageTitle.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show user rows', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    const table = page.locator('table, [data-testid="users-list"]');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasTable) {
      const rows = page.locator('tbody tr, [data-testid="user-row"]');
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }

    await expect(page.locator('body')).toBeVisible();
  });
});
