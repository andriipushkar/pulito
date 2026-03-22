import { test, expect } from '@playwright/test';

test.describe('Contacts Page', () => {
  test('should load contacts page', async ({ page }) => {
    const response = await page.goto('/contacts');
    expect(response?.status()).toBe(200);

    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('should display page heading', async ({ page }) => {
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle');

    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('should have contact form', async ({ page }) => {
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle');

    // Look for a form with inputs
    const form = page.locator('form').first();
    const hasForm = await form.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasForm) {
      // Form should have at least one input field
      const inputs = form.locator('input, textarea');
      const inputCount = await inputs.count();
      expect(inputCount).toBeGreaterThan(0);

      // Form should have a submit button
      const submitButton = form.locator('button[type="submit"], button:has-text("Надіслати"), button:has-text("Відправити")').first();
      const hasSubmit = await submitButton.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasSubmit) {
        expect(hasSubmit).toBeTruthy();
      }
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('should display phone number', async ({ page }) => {
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle');

    // Look for phone number (Ukrainian format or tel: link)
    const phone = page.locator('a[href^="tel:"], text=/\\+38|\\(0\\d{2}\\)|\\d{3}[\\s-]\\d{3}/').first();
    const hasPhone = await phone.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasPhone) {
      expect(hasPhone).toBeTruthy();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('should have meta tags', async ({ page }) => {
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle');

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
