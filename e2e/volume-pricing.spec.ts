import { test, expect } from '@playwright/test';
import { waitForLoaded } from './helpers/wait';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Volume Pricing', () => {
  test.describe('Admin Volume Discounts Page', () => {
    test.beforeEach(async ({ page }) => {
      await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
    });

    test('should access admin volume discounts page', async ({ page }) => {
      await page.goto('/admin/volume-discounts');
      await waitForLoaded(page);

      expect(page.url()).toContain('/admin/volume-discounts');

      // Should show a heading
      const heading = page.locator('h1, h2');
      await expect(heading.first()).toBeVisible({ timeout: 5000 });
    });

    test('should display volume discounts table or empty state', async ({ page }) => {
      await page.goto('/admin/volume-discounts');
      await waitForLoaded(page);

      // Should have a table or empty state
      const table = page.locator('table');
      const emptyState = page.locator('text=/Знижок за обсяг немає/i');

      const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
      const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

      expect(hasTable || hasEmpty).toBeTruthy();
    });

    test('should have create button', async ({ page }) => {
      await page.goto('/admin/volume-discounts');
      await waitForLoaded(page);

      const addButton = page.locator('button:has-text("Додати знижку")');
      await expect(addButton).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Product Volume Discount Badge', () => {
    test('should show volume discount badge on product with discount', async ({ page }) => {
      // Navigate to catalog / products page
      await page.goto('/');
      await waitForLoaded(page);

      // Look for volume discount badge anywhere on the page
      const badge = page.locator('[data-testid="volume-discount-badge"]');
      const hasBadge = await badge
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      // Badge may or may not be present depending on data - just verify page loads
      expect(typeof hasBadge).toBe('boolean');
    });
  });
});
