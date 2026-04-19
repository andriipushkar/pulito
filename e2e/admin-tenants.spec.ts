import { test, expect } from '@playwright/test';
import { waitForLoaded } from './helpers/wait';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Admin Tenants Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  });

  test('should navigate to admin tenants page', async ({ page }) => {
    await page.goto('/admin/tenants');
    await waitForLoaded(page);

    expect(page.url()).toContain('/admin/tenants');

    // Should show tenants heading
    const heading = page.locator('h2');
    await expect(heading.first()).toBeVisible({ timeout: 5000 });
    await expect(heading.first()).toHaveText(/Тенанти/i);
  });

  test('should display tenants table or empty state', async ({ page }) => {
    await page.goto('/admin/tenants');
    await waitForLoaded(page);

    // Either tenants table or empty state should be visible
    const table = page.locator('table');
    const emptyState = page.locator('text=/Тенантів немає/i');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test('should show create tenant form when clicking add button', async ({ page }) => {
    await page.goto('/admin/tenants');
    await waitForLoaded(page);

    const addButton = page.locator('button', { hasText: /Створити тенант/i });
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();

    // Form fields should appear
    const nameInput = page.locator('input').first();
    await expect(nameInput).toBeVisible({ timeout: 3000 });
  });
});
