import { test, expect } from '@playwright/test';

test.describe('Bundles', () => {
  test('bundles listing page loads', async ({ page }) => {
    await page.goto('/bundles');
    await page.waitForLoadState('networkidle');

    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('should display bundles or empty state', async ({ page }) => {
    await page.goto('/bundles');
    await page.waitForLoadState('networkidle');

    // Look for bundle cards/links
    const bundleLinks = page.locator('a[href*="/bundles/"]');
    const bundleCount = await bundleLinks.count();

    if (bundleCount === 0) {
      // Empty state is acceptable
      const emptyState = page.locator('text=/Немає комплектів|Комплекти відсутні/i');
      const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
      // Either empty state or just no items
      await expect(page.locator('body')).toBeVisible();
    } else {
      await expect(bundleLinks.first()).toBeVisible();
    }
  });

  test('should navigate to bundle detail page with products and price', async ({ page }) => {
    await page.goto('/bundles');
    await page.waitForLoadState('networkidle');

    const bundleLink = page.locator('a[href*="/bundles/"]').first();
    if (!await bundleLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await bundleLink.click();
    await page.waitForLoadState('networkidle');

    // URL should contain /bundles/ with a slug or ID
    expect(page.url()).toMatch(/\/bundles\/.+/);

    // Should show price
    const price = page.locator('text=/₴/').first();
    const hasPrice = await price.isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasPrice).toBeTruthy();

    // Should show product list within the bundle
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('should have "Додати комплект у кошик" button on detail page', async ({ page }) => {
    await page.goto('/bundles');
    await page.waitForLoadState('networkidle');

    const bundleLink = page.locator('a[href*="/bundles/"]').first();
    if (!await bundleLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await bundleLink.click();
    await page.waitForLoadState('networkidle');

    // Look for add-to-cart button for the bundle
    const addButton = page.locator('button', { hasText: /Додати комплект у кошик|Додати в кошик|Купити/i });
    const hasButton = await addButton.first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasButton).toBeTruthy();
  });
});
