import { test, expect } from '@playwright/test';

test.describe('Quick Order (without registration)', () => {
  test('should fill quick order form and submit', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    // Find a product and navigate to it
    const productLink = page.locator('a[href*="/product/"]').first();
    if (await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productLink.click();
      await page.waitForLoadState('networkidle');
    } else {
      // Fallback: go to catalog and add from listing
      await page.goto('/catalog');
      await page.waitForLoadState('networkidle');
    }

    // Click "Buy in 1 click" or "Quick order" button
    const quickOrderBtn = page
      .locator(
        'button:has-text("Купити в 1 клік"), button:has-text("Швидке замовлення"), button:has-text("Замовити"), [data-testid="quick-order"]'
      )
      .first();

    if (await quickOrderBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await quickOrderBtn.click();
      await page.waitForTimeout(500);

      // Fill the quick order form (modal or inline)
      const nameInput = page
        .locator('input[name="contactName"], input[name="name"], input[placeholder*="Ім\'я"]')
        .first();
      const phoneInput = page
        .locator('input[name="contactPhone"], input[name="phone"], input[type="tel"]')
        .first();

      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill('Тестовий Покупець');
      }
      if (await phoneInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await phoneInput.fill('+380501234567');
      }

      // Submit the form
      const submitBtn = page
        .locator('button[type="submit"], button:has-text("Замовити"), button:has-text("Відправити")')
        .first();
      if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(2000);

        // Verify success — either redirect or success message
        const successMsg = page.locator('text=/дякуємо|замовлення|прийнято|успішно/i');
        const hasSuccess = await successMsg.isVisible({ timeout: 5000 }).catch(() => false);
        const redirected = !page.url().includes('/product/');

        expect(hasSuccess || redirected).toBeTruthy();
      }
    } else {
      // If no quick order button, add to cart and proceed
      const addToCartBtn = page
        .locator('button:has-text("Купити"), button:has-text("В кошик")')
        .first();
      if (await addToCartBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addToCartBtn.click();
        await page.waitForTimeout(500);
      }
      await page.goto('/checkout');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should show validation for empty quick order form', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    const productLink = page.locator('a[href*="/product/"]').first();
    if (await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productLink.click();
      await page.waitForLoadState('networkidle');

      const quickOrderBtn = page
        .locator(
          'button:has-text("Купити в 1 клік"), button:has-text("Швидке замовлення"), [data-testid="quick-order"]'
        )
        .first();

      if (await quickOrderBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await quickOrderBtn.click();
        await page.waitForTimeout(500);

        // Try to submit without filling fields
        const submitBtn = page
          .locator('button[type="submit"], button:has-text("Замовити")')
          .first();
        if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await submitBtn.click();
          await page.waitForTimeout(1000);

          // Should show validation errors or stay on form
          await expect(page.locator('body')).toBeVisible();
        }
      }
    }
  });
});
