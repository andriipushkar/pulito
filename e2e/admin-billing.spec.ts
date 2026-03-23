import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Admin Billing Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  });

  test('should access admin billing page', async ({ page }) => {
    await page.goto('/admin/billing');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display billing page title', async ({ page }) => {
    await page.goto('/admin/billing');
    await page.waitForLoadState('networkidle');

    const pageTitle = page.locator('h1, h2');
    await expect(pageTitle.first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to plans page', async ({ page }) => {
    await page.goto('/admin/billing/plans');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin/billing/plans');
    await expect(page.locator('body')).toBeVisible();

    const pageTitle = page.locator('h1, h2');
    await expect(pageTitle.first()).toBeVisible({ timeout: 5000 });
  });
});
