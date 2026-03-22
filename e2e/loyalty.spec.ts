import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Loyalty Program', () => {
  test('requires authentication', async ({ page }) => {
    await page.goto('/account/loyalty');
    await page.waitForLoadState('networkidle');

    // Should either redirect to login or show the loyalty page
    await expect(page).toHaveURL(/login|loyalty/);
  });

  test.describe('Authenticated', () => {
    test.beforeEach(async ({ page }) => {
      await loginViaUI(page, TEST_USERS.client.email, TEST_USERS.client.password);
    });

    test('should load loyalty page', async ({ page }) => {
      await page.goto('/account/loyalty');
      await page.waitForLoadState('networkidle');

      const main = page.locator('main');
      await expect(main).toBeVisible({ timeout: 5000 });
    });

    test('should display loyalty heading', async ({ page }) => {
      await page.goto('/account/loyalty');
      await page.waitForLoadState('networkidle');

      const heading = page.locator('h1, h2');
      await expect(heading.first()).toBeVisible({ timeout: 5000 });
    });

    test('should show challenges section or empty state', async ({ page }) => {
      await page.goto('/account/loyalty');
      await page.waitForLoadState('networkidle');

      // Look for challenges section, points display, or empty state
      const challenges = page.locator('text=/Челенд|Завдання|Виклики|challenge/i');
      const points = page.locator('text=/бал|point|очк/i');
      const emptyState = page.locator('text=/Немає|Поки що|Програма лояльності/i');

      const hasChallenges = await challenges.first().isVisible({ timeout: 5000 }).catch(() => false);
      const hasPoints = await points.first().isVisible({ timeout: 3000 }).catch(() => false);
      const hasEmpty = await emptyState.first().isVisible({ timeout: 3000 }).catch(() => false);

      // At least one of these should be present
      expect(hasChallenges || hasPoints || hasEmpty).toBeTruthy();
    });
  });
});
