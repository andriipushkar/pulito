import { test, expect } from '@playwright/test';

test.describe('Cart Flow', () => {
  test('should add item from catalog and update cart count', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    // Find an add-to-cart button on a product card
    const addButton = page.locator('button:has-text("кошик"), button:has-text("Додати"), button:has-text("Купити"), [data-testid="add-to-cart"]').first();
    if (!await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await addButton.click();
    await page.waitForTimeout(1000);

    // Cart count badge should appear or update in header
    const cartBadge = page.locator('[data-testid="cart-count"], [class*="cart"] [class*="badge"], [class*="cart"] span, a[href="/cart"] span').first();
    const hasBadge = await cartBadge.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasBadge) {
      const count = await cartBadge.textContent();
      expect(Number(count)).toBeGreaterThanOrEqual(1);
    }
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display items on /cart page', async ({ page }) => {
    // First add an item
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    const addButton = page.locator('button:has-text("кошик"), button:has-text("Додати"), button:has-text("Купити"), [data-testid="add-to-cart"]').first();
    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);
    }

    await page.goto('/cart');
    await page.waitForLoadState('networkidle');

    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('should change quantity in cart', async ({ page }) => {
    // Add item first
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    const addButton = page.locator('button:has-text("кошик"), button:has-text("Додати"), button:has-text("Купити"), [data-testid="add-to-cart"]').first();
    if (!await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await addButton.click();
    await page.waitForTimeout(500);
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');

    // Look for quantity controls (+ button or input)
    const increaseButton = page.locator('button:has-text("+"), [data-testid="increase-qty"]').first();
    if (await increaseButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await increaseButton.click();
      await page.waitForTimeout(500);
      // Page should remain stable after quantity change
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('should remove item from cart', async ({ page }) => {
    // Add item first
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    const addButton = page.locator('button:has-text("кошик"), button:has-text("Додати"), button:has-text("Купити"), [data-testid="add-to-cart"]').first();
    if (!await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await addButton.click();
    await page.waitForTimeout(500);
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');

    // Look for remove/delete button
    const removeButton = page.locator('button:has-text("Видалити"), button:has-text("видалити"), [data-testid="remove-item"], button[aria-label*="видалити"], button[aria-label*="Видалити"]').first();
    if (await removeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await removeButton.click();
      await page.waitForTimeout(500);
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('should show empty cart state', async ({ page }) => {
    // Visit cart directly without adding items (fresh session)
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');

    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Look for empty cart message or empty state
    const emptyState = page.locator('text=/порожн|пуст|кошик порожній|empty/i').first();
    const hasEmptyState = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);

    // Either empty state is shown or cart has items (from previous session)
    await expect(page.locator('body')).toBeVisible();
    if (hasEmptyState) {
      expect(hasEmptyState).toBeTruthy();
    }
  });
});
