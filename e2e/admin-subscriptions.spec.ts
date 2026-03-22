import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Admin Subscriptions Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  });

  test('should access admin subscriptions page', async ({ page }) => {
    await page.goto('/admin/subscriptions');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should render subscriptions content', async ({ page }) => {
    await page.goto('/admin/subscriptions');
    await page.waitForLoadState('networkidle');

    const pageTitle = page.locator('h1, h2');
    await expect(pageTitle.first()).toBeVisible({ timeout: 5000 });
  });
});
