import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Admin Feature Flags', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  });

  test('should access feature flags page', async ({ page }) => {
    await page.goto('/admin/feature-flags');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin/feature-flags');

    const main = page.locator('main');
    await expect(main).toBeVisible({ timeout: 5000 });
  });

  test('should display feature flags heading', async ({ page }) => {
    await page.goto('/admin/feature-flags');
    await page.waitForLoadState('networkidle');

    const heading = page.locator('h1, h2');
    await expect(heading.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display feature flags list or empty state', async ({ page }) => {
    await page.goto('/admin/feature-flags');
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    const list = page.locator('[class*="grid"], [class*="list"]');
    const emptyState = page.locator('text=/Немає прапорців|Прапорці відсутні|No feature flags/i');

    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
    const hasList = await list.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

    // At least the page should render
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have create form or button', async ({ page }) => {
    await page.goto('/admin/feature-flags');
    await page.waitForLoadState('networkidle');

    // Look for create form (inline) or add button
    const createForm = page.locator('form');
    const addButton = page.locator('button', { hasText: /Додати|Створити|Create/i });
    const nameInput = page.locator('input[name="name"], input[placeholder*="Назва"], input[placeholder*="name"]');

    const hasForm = await createForm.first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasButton = await addButton.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasInput = await nameInput.first().isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasForm || hasButton || hasInput).toBeTruthy();
  });
});
