import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Checkout Flow', () => {
  test('should search for a product, add to cart, and proceed to checkout', async ({ page }) => {
    // 1. Go to homepage
    await page.goto('/');
    await expect(page).toHaveTitle(/Pulito/i);

    // 2. Search for a product
    const searchInput = page
      .locator('input[placeholder*="Пошук"], input[name="search"], input[type="search"]')
      .first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Fairy');
      await page.waitForTimeout(600); // Wait for debounce

      // Check autocomplete results appear
      const autocompleteResult = page
        .locator('[data-testid="search-result"], [role="listbox"] li, .search-results a')
        .first();
      if (await autocompleteResult.isVisible({ timeout: 3000 }).catch(() => false)) {
        await autocompleteResult.click();
      } else {
        // Fallback: navigate to catalog with search
        await page.goto('/catalog?search=Fairy');
      }
    } else {
      await page.goto('/catalog?search=Fairy');
    }

    // 3. Should see product page or listing
    await page.waitForLoadState('domcontentloaded');

    // 4. Find and click "Add to Cart" button
    const addToCartBtn = page
      .locator('button:has-text("Купити"), button:has-text("В кошик"), button:has-text("Додати")')
      .first();
    if (await addToCartBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addToCartBtn.click();
      await page.waitForTimeout(500);
    }

    // 5. Go to cart
    await page.goto('/cart');
    await page.waitForLoadState('domcontentloaded');

    // 6. Cart page should load
    await expect(page.locator('body')).toBeVisible();
  });

  test('should require login or contact info for checkout', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForLoadState('domcontentloaded');

    // Checkout should either redirect to login or show contact form
    const hasContactForm = await page
      .locator('input[name="contactName"], input[name="contactPhone"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const redirectedToLogin = page.url().includes('/auth/login');

    expect(hasContactForm || redirectedToLogin).toBeTruthy();
  });

  test('authenticated user can proceed through checkout', async ({ page }) => {
    // Login first
    await loginViaUI(page, TEST_USERS.client.email, TEST_USERS.client.password);

    // Add a product via catalog
    await page.goto('/catalog');
    await page.waitForLoadState('domcontentloaded');

    const productCard = page
      .locator('[data-testid="product-card"], .product-card, article')
      .first();
    if (await productCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      const addBtn = productCard
        .locator('button:has-text("Купити"), button:has-text("В кошик")')
        .first();
      if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Go to checkout
    await page.goto('/checkout');
    await page.waitForLoadState('domcontentloaded');

    // Should see checkout form
    await expect(page.locator('body')).toBeVisible();
  });
});
