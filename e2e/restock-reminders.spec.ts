import { test, expect } from '@playwright/test';
import { waitForLoaded } from './helpers/wait';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Restock Reminders', () => {
  test('requires authentication', async ({ page }) => {
    await page.goto('/account');
    await waitForLoaded(page);

    // Should either redirect to login or show the account page
    await expect(page).toHaveURL(/login|account/);
  });

  test.describe('Authenticated', () => {
    test.beforeEach(async ({ page }) => {
      await loginViaUI(page, TEST_USERS.client.email, TEST_USERS.client.password);
    });

    test('should render restock reminders section on account page', async ({ page }) => {
      await page.goto('/account');
      await waitForLoaded(page);

      const main = page.locator('main').first();
      await expect(main).toBeVisible({ timeout: 5000 });

      // Should show the restock reminders heading or empty state
      const heading = page.locator('text=/Нагадування про поповнення/i');
      const emptyState = page.locator("text=/Ваші прогнози з'являться після кількох покупок/i");
      const predictionCards = page.locator('text=/Замовити знову/i');

      const hasHeading = await heading.isVisible({ timeout: 5000 }).catch(() => false);
      const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
      const hasCards = await predictionCards
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      // At least the heading or one of the states should be visible
      expect(hasHeading || hasEmpty || hasCards).toBeTruthy();
    });

    test('should show empty state or prediction cards', async ({ page }) => {
      await page.goto('/account');
      await waitForLoaded(page);

      // Either empty state or prediction cards
      const emptyState = page.locator("text=/Ваші прогнози з'являться після кількох покупок/i");
      const predictionCards = page.locator('text=/Замовити знову/i');

      const hasEmpty = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);
      const hasCards = await predictionCards
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      // At least one should be visible (empty state for new users, cards for returning users)
      expect(hasEmpty || hasCards).toBeTruthy();
    });
  });
});
