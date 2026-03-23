import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Admin Marketplaces Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  });

  test('should access admin marketplaces page', async ({ page }) => {
    await page.goto('/admin/marketplaces');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should render marketplaces content', async ({ page }) => {
    await page.goto('/admin/marketplaces');
    await page.waitForLoadState('networkidle');

    const pageTitle = page.locator('h1, h2');
    await expect(pageTitle.first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Admin Marketplace Returns Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  });

  test('should navigate to marketplace returns page', async ({ page }) => {
    await page.goto('/admin/marketplaces/returns');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin/marketplaces/returns');
    await expect(page.locator('h1')).toContainText('Повернення з маркетплейсів');
  });

  test('should verify returns table loads', async ({ page }) => {
    await page.goto('/admin/marketplaces/returns');
    await page.waitForLoadState('networkidle');

    // Table or empty state should be visible
    const table = page.locator('[data-testid="returns-table"]');
    const emptyState = page.locator('text=Повернень не знайдено');
    await expect(table.or(emptyState)).toBeVisible({ timeout: 5000 });
  });

  test('should have status filter dropdown', async ({ page }) => {
    await page.goto('/admin/marketplaces/returns');
    await page.waitForLoadState('networkidle');

    const filter = page.locator('[data-testid="status-filter"]');
    await expect(filter).toBeVisible();
  });
});
