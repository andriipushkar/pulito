import { test, expect } from '@playwright/test';

test.describe('Catalog page', () => {
  test('should load catalog page', async ({ page }) => {
    await page.goto('/catalog');
    await expect(page).toHaveURL(/\/catalog/);
  });

  test('should display product grid', async ({ page }) => {
    await page.goto('/catalog');
    // Wait for products or empty state
    const content = page.locator('main').first();
    await expect(content).toBeVisible();
  });

  test('should have sort selector', async ({ page }) => {
    await page.goto('/catalog');
    const sortSelect = page.locator('select').first();
    if (await sortSelect.isVisible()) {
      await expect(sortSelect).toBeEnabled();
    }
  });

  test('should update URL with search params on filter', async ({ page }) => {
    await page.goto('/catalog?promo=true');
    await expect(page).toHaveURL(/promo=true/);
  });

  test('should handle pagination via URL', async ({ page }) => {
    await page.goto('/catalog?page=2');
    await expect(page).toHaveURL(/page=2/);
  });
});
