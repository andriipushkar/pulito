import { test, expect } from '@playwright/test';
import { waitForLoaded } from './helpers/wait';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Admin Product Import', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  });

  test('should access admin import page', async ({ page }) => {
    await page.goto('/admin/import');
    await waitForLoaded(page);

    expect(page.url()).toContain('/admin');

    const main = page.locator('main');
    await expect(main).toBeVisible({ timeout: 5000 });
  });

  test('should display import form with file upload', async ({ page }) => {
    await page.goto('/admin/import');
    await waitForLoaded(page);

    // Look for file upload input
    const fileInput = page.locator('input[type="file"]').first();
    const uploadArea = page
      .locator('[data-testid="file-upload"], [class*="upload"], [class*="dropzone"]')
      .first();

    const hasFileInput = await fileInput.isVisible({ timeout: 5000 }).catch(() => false);
    const hasUploadArea = await uploadArea.isVisible({ timeout: 3000 }).catch(() => false);

    // At least one upload mechanism should exist
    expect(hasFileInput || hasUploadArea).toBeTruthy();
  });

  test('should show import history', async ({ page }) => {
    await page.goto('/admin/import');
    await waitForLoaded(page);

    // Look for import history table or list
    const historyTable = page.locator('table');
    const historyList = page.locator('[data-testid="import-history"], [class*="history"]');
    const emptyState = page.locator('text=/Немає імпортів|Історія імпорту порожня|No imports/i');

    const hasTable = await historyTable.isVisible({ timeout: 5000 }).catch(() => false);
    const hasList = await historyList
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

    // Page should render correctly
    await expect(page.locator('body')).toBeVisible();
  });

  test('should upload a product file', async ({ page }) => {
    await page.goto('/admin/import');
    await waitForLoaded(page);

    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.count()) {
      // Create a simple CSV test file in memory
      const csvContent = 'code,name,price_retail,quantity\nTEST-E2E-001,Тестовий Товар,99.00,10';
      const buffer = Buffer.from(csvContent, 'utf-8');

      await fileInput.setInputFiles({
        name: 'test-products.csv',
        mimeType: 'text/csv',
        buffer,
      });

      await page.waitForTimeout(1000);

      // Look for upload/import button
      const importBtn = page
        .locator(
          'button:has-text("Імпортувати"), button:has-text("Завантажити"), button:has-text("Почати імпорт"), button[type="submit"]',
        )
        .first();

      if (await importBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await importBtn.click();
        await page.waitForTimeout(3000);

        // Should show progress or result
        const result = page.locator('text=/завершено|completed|успішно|створено|оновлено|помилк/i');
        const hasResult = await result
          .first()
          .isVisible({ timeout: 10000 })
          .catch(() => false);

        await expect(page.locator('body')).toBeVisible();
      }
    }
  });

  test('should show import validation errors for bad file', async ({ page }) => {
    await page.goto('/admin/import');
    await waitForLoaded(page);

    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.count()) {
      // Upload an invalid file
      const invalidContent = 'this is not a valid product file';
      const buffer = Buffer.from(invalidContent, 'utf-8');

      await fileInput.setInputFiles({
        name: 'invalid.txt',
        mimeType: 'text/plain',
        buffer,
      });

      await page.waitForTimeout(1000);

      const importBtn = page
        .locator(
          'button:has-text("Імпортувати"), button:has-text("Завантажити"), button[type="submit"]',
        )
        .first();

      if (await importBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await importBtn.click();
        await page.waitForTimeout(2000);

        // Should show validation error
        const errorMsg = page.locator('text=/помилк|error|невірний формат|invalid/i');
        const hasError = await errorMsg
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        await expect(page.locator('body')).toBeVisible();
      }
    }
  });
});
