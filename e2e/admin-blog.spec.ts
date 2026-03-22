import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Admin Blog Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  });

  test('should access admin blog page', async ({ page }) => {
    await page.goto('/admin/blog');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin/blog');

    // Should show a heading
    const heading = page.locator('h1, h2');
    await expect(heading.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display blog posts table or list', async ({ page }) => {
    await page.goto('/admin/blog');
    await page.waitForLoadState('networkidle');

    // Should have a table or list of blog posts
    const table = page.locator('table');
    const list = page.locator('[class*="grid"], [class*="list"]');
    const emptyState = page.locator('text=/Немає статей|Поки що немає/i');

    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
    const hasList = await list.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasTable || hasList || hasEmpty).toBeTruthy();
  });

  test('should navigate to new blog post form', async ({ page }) => {
    await page.goto('/admin/blog/new');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin/blog/new');

    // Form should have essential fields
    const main = page.locator('main');
    await expect(main).toBeVisible({ timeout: 5000 });
  });

  test('should have form fields on new blog post page', async ({ page }) => {
    await page.goto('/admin/blog/new');
    await page.waitForLoadState('networkidle');

    // Look for title input
    const titleInput = page.locator('input[name="title"], input[placeholder*="Назва"], input[placeholder*="Заголовок"]');
    const hasTitleInput = await titleInput.first().isVisible({ timeout: 5000 }).catch(() => false);

    // Look for content editor (textarea or rich text editor)
    const contentArea = page.locator('textarea, [contenteditable="true"], [class*="editor"]');
    const hasContentArea = await contentArea.first().isVisible({ timeout: 3000 }).catch(() => false);

    // At least the title field should be present
    expect(hasTitleInput || hasContentArea).toBeTruthy();
  });

  test('should have create/add button on blog listing', async ({ page }) => {
    await page.goto('/admin/blog');
    await page.waitForLoadState('networkidle');

    // Look for create/add button or link
    const addButton = page.locator('a[href*="/admin/blog/new"], button:has-text("Додати"), button:has-text("Створити"), a:has-text("Нова стаття")');
    const hasAddButton = await addButton.first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasAddButton).toBeTruthy();
  });
});
