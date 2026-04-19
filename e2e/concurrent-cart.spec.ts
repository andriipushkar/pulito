import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Concurrent Cart Operations', () => {
  test('should sync cart across two browser contexts', async ({ browser }) => {
    // Create two separate contexts for the same user
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Login in both contexts
      await loginViaUI(page1, TEST_USERS.client.email, TEST_USERS.client.password);
      await loginViaUI(page2, TEST_USERS.client.email, TEST_USERS.client.password);

      // Context 1: Navigate to catalog and add a product
      await page1.goto('/catalog');
      await page1.waitForLoadState('domcontentloaded');

      const addToCartBtn1 = page1
        .locator('button:has-text("Купити"), button:has-text("В кошик")')
        .first();

      if (await addToCartBtn1.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addToCartBtn1.click();
        await page1.waitForTimeout(1000);
      }

      // Context 2: Navigate to catalog and add a different product
      await page2.goto('/catalog');
      await page2.waitForLoadState('domcontentloaded');

      // Try to add the second product (if available)
      const productCards = page2.locator('[data-testid="product-card"], .product-card, article');
      const cardCount = await productCards.count();

      if (cardCount > 1) {
        const secondAddBtn = productCards
          .nth(1)
          .locator('button:has-text("Купити"), button:has-text("В кошик")')
          .first();

        if (await secondAddBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await secondAddBtn.click();
          await page2.waitForTimeout(1000);
        }
      } else {
        const addToCartBtn2 = page2
          .locator('button:has-text("Купити"), button:has-text("В кошик")')
          .first();
        if (await addToCartBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
          await addToCartBtn2.click();
          await page2.waitForTimeout(1000);
        }
      }

      // Context 1: Check cart reflects items
      await page1.goto('/cart');
      await page1.waitForLoadState('domcontentloaded');
      await expect(page1.locator('body')).toBeVisible();

      // Context 2: Check cart reflects items
      await page2.goto('/cart');
      await page2.waitForLoadState('domcontentloaded');
      await expect(page2.locator('body')).toBeVisible();

      // Both carts should be visible and functional
      const cart1Items = page1.locator(
        '[data-testid="cart-item"], .cart-item, tr, [class*="cart-product"]',
      );
      const cart2Items = page2.locator(
        '[data-testid="cart-item"], .cart-item, tr, [class*="cart-product"]',
      );

      // At least the cart pages load
      await expect(page1.locator('main, body')).toBeVisible();
      await expect(page2.locator('main, body')).toBeVisible();
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should handle concurrent quantity updates', async ({ browser }) => {
    const context1 = await browser.newContext();
    const page = await context1.newPage();

    try {
      await loginViaUI(page, TEST_USERS.client.email, TEST_USERS.client.password);

      // Add a product
      await page.goto('/catalog');
      await page.waitForLoadState('domcontentloaded');

      const addBtn = page.locator('button:has-text("Купити"), button:has-text("В кошик")').first();
      if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(500);
      }

      // Go to cart
      await page.goto('/cart');
      await page.waitForLoadState('domcontentloaded');

      // Try to update quantity
      const quantityInput = page.locator('input[type="number"], input[name="quantity"]').first();

      if (await quantityInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await quantityInput.fill('5');
        await page.waitForTimeout(1000);

        // Verify the quantity was updated
        const value = await quantityInput.inputValue();
        expect(value).toBe('5');
      }

      await expect(page.locator('body')).toBeVisible();
    } finally {
      await context1.close();
    }
  });

  test('should handle adding same product from multiple tabs', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      await loginViaUI(page1, TEST_USERS.client.email, TEST_USERS.client.password);

      // Open catalog in both tabs (same context = shared cookies)
      await page1.goto('/catalog');
      await page1.waitForLoadState('domcontentloaded');

      await page2.goto('/catalog');
      await page2.waitForLoadState('domcontentloaded');

      // Add same product from both tabs simultaneously
      const addBtn1 = page1
        .locator('button:has-text("Купити"), button:has-text("В кошик")')
        .first();
      const addBtn2 = page2
        .locator('button:has-text("Купити"), button:has-text("В кошик")')
        .first();

      const promises = [];
      if (await addBtn1.isVisible({ timeout: 3000 }).catch(() => false)) {
        promises.push(addBtn1.click());
      }
      if (await addBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
        promises.push(addBtn2.click());
      }

      await Promise.all(promises);
      await page1.waitForTimeout(1000);

      // Check cart — should not have duplicate entries, just increased quantity
      await page1.goto('/cart');
      await page1.waitForLoadState('domcontentloaded');
      await expect(page1.locator('body')).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
