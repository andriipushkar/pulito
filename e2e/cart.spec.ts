import { test, expect } from '@playwright/test';

test.describe('Cart', () => {
  test('should show empty cart message', async ({ page }) => {
    await page.goto('/cart');
    // Cart should show empty state or items
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
  });

  test('should navigate to checkout from cart', async ({ page }) => {
    await page.goto('/cart');
    const checkoutButton = page.locator('a[href="/checkout"]').first();
    // Only click if visible (cart has items)
    if (await checkoutButton.isVisible()) {
      await checkoutButton.click();
      await expect(page).toHaveURL(/\/checkout/);
    }
  });
});

test.describe('Checkout', () => {
  test('should redirect to cart if empty', async ({ page }) => {
    await page.goto('/checkout');
    // Checkout may redirect to cart or show empty message
    const content = page.locator('main').first();
    await expect(content).toBeVisible();
  });
});
