import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests — порівняння скріншотів між деплоями.
 *
 * Перший запуск: створює baseline скріншоти в e2e/visual-regression.spec.ts-snapshots/
 * Наступні запуски: порівнює з baseline, падає при відмінностях > 0.5%
 *
 * Запуск:
 *   npx playwright test e2e/visual-regression.spec.ts
 *
 * Оновити baseline після навмисних змін дизайну:
 *   npx playwright test e2e/visual-regression.spec.ts --update-snapshots
 */

test.describe('Visual Regression — Desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Hide dynamic content that changes between runs
    await page.evaluate(() => {
      document.querySelectorAll('[data-testid="banner-slider"]').forEach(el => (el as HTMLElement).style.opacity = '0');
    });
    await expect(page).toHaveScreenshot('desktop-homepage.png', {
      maxDiffPixelRatio: 0.005,
      fullPage: true,
    });
  });

  test('Catalog', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('desktop-catalog.png', {
      maxDiffPixelRatio: 0.005,
      fullPage: false, // only viewport — catalog can be very long
    });
  });

  test('Product Page', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');
    const firstProduct = page.locator('a[href^="/product/"]').first();
    if (await firstProduct.isVisible()) {
      await firstProduct.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot('desktop-product.png', {
        maxDiffPixelRatio: 0.005,
        fullPage: false,
      });
    }
  });

  test('Cart (empty)', async ({ page }) => {
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('desktop-cart-empty.png', {
      maxDiffPixelRatio: 0.005,
    });
  });

  test('Login page', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('desktop-login.png', {
      maxDiffPixelRatio: 0.005,
    });
  });

  test('Register page', async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('desktop-register.png', {
      maxDiffPixelRatio: 0.005,
    });
  });

  test('FAQ page', async ({ page }) => {
    await page.goto('/faq');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('desktop-faq.png', {
      maxDiffPixelRatio: 0.005,
      fullPage: true,
    });
  });

  test('Contacts page', async ({ page }) => {
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle');
    // Hide map iframe (changes between loads)
    await page.evaluate(() => {
      document.querySelectorAll('iframe').forEach(el => (el as HTMLElement).style.visibility = 'hidden');
    });
    await expect(page).toHaveScreenshot('desktop-contacts.png', {
      maxDiffPixelRatio: 0.005,
    });
  });

  test('Header & Footer', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const header = page.locator('header').first();
    await expect(header).toHaveScreenshot('desktop-header.png', {
      maxDiffPixelRatio: 0.005,
    });
    const footer = page.locator('footer').first();
    await expect(footer).toHaveScreenshot('desktop-footer.png', {
      maxDiffPixelRatio: 0.005,
    });
  });
});

test.describe('Visual Regression — Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } }); // iPhone SE

  test('Homepage mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.querySelectorAll('[data-testid="banner-slider"]').forEach(el => (el as HTMLElement).style.opacity = '0');
    });
    await expect(page).toHaveScreenshot('mobile-homepage.png', {
      maxDiffPixelRatio: 0.005,
    });
  });

  test('Catalog mobile', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('mobile-catalog.png', {
      maxDiffPixelRatio: 0.005,
    });
  });

  test('Product mobile', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');
    const firstProduct = page.locator('a[href^="/product/"]').first();
    if (await firstProduct.isVisible()) {
      await firstProduct.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot('mobile-product.png', {
        maxDiffPixelRatio: 0.005,
      });
    }
  });

  test('Login mobile', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('mobile-login.png', {
      maxDiffPixelRatio: 0.005,
    });
  });

  test('Cart mobile', async ({ page }) => {
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('mobile-cart.png', {
      maxDiffPixelRatio: 0.005,
    });
  });
});
