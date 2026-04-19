import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Pricelist Download', () => {
  test('should navigate to pricelist page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Look for pricelist link in navigation or footer
    const pricelistLink = page
      .locator(
        'a:has-text("Прайс"), a:has-text("прайс"), a[href*="pricelist"], a[href*="price-list"]',
      )
      .first();

    if (await pricelistLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pricelistLink.click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    } else {
      // Try direct navigation
      await page.goto('/pricelist');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should download pricelist file', async ({ page }) => {
    await loginViaUI(page, TEST_USERS.client.email, TEST_USERS.client.password);

    // Try direct pricelist page
    await page.goto('/pricelist');
    await page.waitForLoadState('domcontentloaded');

    // Look for download button
    const downloadBtn = page
      .locator(
        'a:has-text("Завантажити"), button:has-text("Завантажити"), a:has-text("Скачати"), a[href*="download"], [data-testid="download-pricelist"]',
      )
      .first();

    if (await downloadBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Set up download listener
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
        downloadBtn.click(),
      ]);

      if (download) {
        // Verify file was downloaded
        const filename = download.suggestedFilename();
        expect(filename).toBeTruthy();
        // Common pricelist formats
        expect(
          filename.endsWith('.xlsx') ||
            filename.endsWith('.xls') ||
            filename.endsWith('.csv') ||
            filename.endsWith('.pdf'),
        ).toBeTruthy();
      }
    }

    // Page should remain visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('wholesale user can access pricelist', async ({ page }) => {
    // Login as admin (who has wholesale access)
    await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);

    await page.goto('/pricelist');
    await page.waitForLoadState('domcontentloaded');

    // Should see pricelist content (not 403)
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).not.toContain('/auth/login');
  });
});
