import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Admin Campaigns Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  });

  test('should access admin campaigns page', async ({ page }) => {
    await page.goto('/admin/campaigns');
    await page.waitForLoadState('domcontentloaded');

    expect(page.url()).toContain('/admin');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should render campaigns page with list or empty state', async ({ page }) => {
    await page.goto('/admin/campaigns');
    await page.waitForLoadState('domcontentloaded');

    const pageTitle = page.locator('h2');
    await expect(pageTitle.first()).toBeVisible({ timeout: 5000 });

    // Either campaigns table or empty state should be visible
    const hasTable = await page
      .locator('table')
      .isVisible()
      .catch(() => false);
    const hasEmpty = await page
      .locator('text=Кампаній ще немає')
      .isVisible()
      .catch(() => false);
    expect(hasTable || hasEmpty).toBeTruthy();
  });
});
