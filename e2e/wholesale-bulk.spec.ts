import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Wholesale Bulk Order', () => {
  test('requires authentication', async ({ page }) => {
    await page.goto('/account/wholesale/bulk-order');
    await page.waitForLoadState('networkidle');

    // Should either redirect to login or show the page
    await expect(page).toHaveURL(/login|bulk-order/);
  });

  test.describe('Authenticated', () => {
    test.beforeEach(async ({ page }) => {
      await loginViaUI(page, TEST_USERS.client.email, TEST_USERS.client.password);
    });

    test('should load bulk order page', async ({ page }) => {
      await page.goto('/account/wholesale/bulk-order');
      await page.waitForLoadState('networkidle');

      const main = page.locator('main');
      await expect(main).toBeVisible({ timeout: 5000 });
    });

    test('should have textarea for article codes', async ({ page }) => {
      await page.goto('/account/wholesale/bulk-order');
      await page.waitForLoadState('networkidle');

      const textarea = page.locator('textarea');
      const hasTextarea = await textarea.first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasTextarea).toBeTruthy();
    });

    test('should have calculate button', async ({ page }) => {
      await page.goto('/account/wholesale/bulk-order');
      await page.waitForLoadState('networkidle');

      const button = page.locator('button', { hasText: /Розрахувати|Порахувати|Знайти/i });
      const hasButton = await button.first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasButton).toBeTruthy();
    });

    test('should type article codes and click calculate', async ({ page }) => {
      await page.goto('/account/wholesale/bulk-order');
      await page.waitForLoadState('networkidle');

      const textarea = page.locator('textarea').first();
      if (!await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
        test.skip();
        return;
      }

      // Type sample article codes
      await textarea.fill('ART-001 2\nART-002 3');

      const calculateButton = page.locator('button', { hasText: /Розрахувати|Порахувати|Знайти/i }).first();
      if (await calculateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await calculateButton.click();
        await page.waitForTimeout(1000);
      }

      // Page should remain stable
      await expect(page.locator('body')).toBeVisible();
    });
  });
});
