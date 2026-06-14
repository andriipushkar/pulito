import { test, expect } from '@playwright/test';
import { waitForLoaded } from './helpers/wait';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Admin Billing Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  });

  test('should access admin billing page', async ({ page }) => {
    await page.goto('/admin/billing');
    await waitForLoaded(page);

    expect(page.url()).toContain('/admin');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display billing page title', async ({ page }) => {
    await page.goto('/admin/billing');
    await waitForLoaded(page);

    // When billing API has no record, page shows "Біллінг ще не налаштовано"
    // — no heading. Accept either the heading or the empty-state copy.
    const hasHeading = await page
      .locator('h1, h2')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasEmpty = await page
      .locator('text=/Біллінг ще не налаштовано/i')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasHeading || hasEmpty).toBeTruthy();
  });

  test('should navigate to plans page', async ({ page }) => {
    await page.goto('/admin/billing/plans');
    await waitForLoaded(page);

    expect(page.url()).toContain('/admin/billing/plans');
    await expect(page.locator('body')).toBeVisible();

    const pageTitle = page.locator('h1, h2');
    await expect(pageTitle.first()).toBeVisible({ timeout: 5000 });
  });
});
