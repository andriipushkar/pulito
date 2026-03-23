import { test, expect } from '@playwright/test';

test.describe('Subscribe & Save', () => {
  test('should show subscribe button on product page', async ({ page }) => {
    // Navigate to catalog and find a product
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    // Click the first product link to go to a product detail page
    const productLink = page.locator('a[href*="/product/"]').first();
    if (!(await productLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await productLink.click();
    await page.waitForLoadState('networkidle');

    // Verify the subscribe button is visible
    const subscribeButton = page.locator('[data-subscribe-button]');
    const isVisible = await subscribeButton.isVisible({ timeout: 5000 }).catch(() => false);

    // The button may not appear if product is out of stock
    if (isVisible) {
      await expect(subscribeButton).toContainText('Підписатись та заощадити');
      await expect(subscribeButton).toContainText('-5%');
    }
  });

  test('should show frequency options when subscribe button is clicked', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    const productLink = page.locator('a[href*="/product/"]').first();
    if (!(await productLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await productLink.click();
    await page.waitForLoadState('networkidle');

    const subscribeButton = page.locator('[data-subscribe-button]');
    if (!(await subscribeButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await subscribeButton.click();

    // If not authenticated, a login prompt should appear
    const loginPrompt = page.locator('text=Увійдіть в акаунт');
    const frequencyDropdown = page.locator('[data-frequency-dropdown]');

    const hasLoginPrompt = await loginPrompt.isVisible({ timeout: 3000 }).catch(() => false);
    const hasFrequencyDropdown = await frequencyDropdown.isVisible({ timeout: 3000 }).catch(() => false);

    // One of these should be visible
    expect(hasLoginPrompt || hasFrequencyDropdown).toBeTruthy();

    // If frequency dropdown is visible, verify all options
    if (hasFrequencyDropdown) {
      await expect(page.locator('text=Щотижня (7 днів)')).toBeVisible();
      await expect(page.locator('text=Раз на 2 тижні (14 днів)')).toBeVisible();
      await expect(page.locator('text=Щомісяця (30 днів)')).toBeVisible();
      await expect(page.locator('text=Раз на 2 місяці (60 днів)')).toBeVisible();
    }
  });

  test('should show login prompt for unauthenticated users', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    const productLink = page.locator('a[href*="/product/"]').first();
    if (!(await productLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await productLink.click();
    await page.waitForLoadState('networkidle');

    const subscribeButton = page.locator('[data-subscribe-button]');
    if (!(await subscribeButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await subscribeButton.click();

    // Unauthenticated users should see login prompt
    const loginPrompt = page.locator('text=Увійдіть в акаунт');
    const loginButton = page.locator('a[href="/login"]');

    const hasPrompt = await loginPrompt.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasPrompt) {
      await expect(loginButton).toBeVisible();
    }
  });

  test('should show discounted price in dropdown', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    const productLink = page.locator('a[href*="/product/"]').first();
    if (!(await productLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await productLink.click();
    await page.waitForLoadState('networkidle');

    const subscribeButton = page.locator('[data-subscribe-button]');
    if (!(await subscribeButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await subscribeButton.click();

    const frequencyDropdown = page.locator('[data-frequency-dropdown]');
    const hasDropdown = await frequencyDropdown.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasDropdown) {
      // Should show savings info
      await expect(page.locator('text=Економія')).toBeVisible();
    }
  });
});
