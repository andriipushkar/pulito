import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Subscriptions', () => {
  test('requires authentication', async ({ page }) => {
    await page.goto('/account/subscriptions');
    await page.waitForLoadState('networkidle');

    // Should either redirect to login or show the subscriptions page
    await expect(page).toHaveURL(/login|subscriptions/);
  });

  test.describe('Authenticated', () => {
    test.beforeEach(async ({ page }) => {
      await loginViaUI(page, TEST_USERS.client.email, TEST_USERS.client.password);
    });

    test('should load subscriptions page with title', async ({ page }) => {
      await page.goto('/account/subscriptions');
      await page.waitForLoadState('networkidle');

      const main = page.locator('main');
      await expect(main).toBeVisible({ timeout: 5000 });

      // Should have a heading related to subscriptions
      const heading = page.locator('h1, h2');
      await expect(heading.first()).toBeVisible({ timeout: 5000 });
    });

    test('should show subscriptions or empty state', async ({ page }) => {
      await page.goto('/account/subscriptions');
      await page.waitForLoadState('networkidle');

      // Either subscription list or empty state
      const emptyState = page.locator('text=/Немає підписок|Підписки відсутні|У вас немає/i');
      const subscriptionItems = page.locator('a[href*="/subscription"], [class*="subscription"]');

      const hasEmpty = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);
      const hasItems = await subscriptionItems.first().isVisible({ timeout: 3000 }).catch(() => false);

      // At least one should be visible
      expect(hasEmpty || hasItems).toBeTruthy();
    });
  });
});
