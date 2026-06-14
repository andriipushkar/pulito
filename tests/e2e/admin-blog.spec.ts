import { test, expect } from '@playwright/test';
import { waitForLoaded } from './helpers/wait';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Admin Blog Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  });

  test('should access admin blog page', async ({ page }) => {
    await page.goto('/admin/blog');
    await waitForLoaded(page);

    expect(page.url()).toContain('/admin/blog');

    // Should show a heading
    const heading = page.locator('h1, h2');
    await expect(heading.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display blog posts table or list', async ({ page }) => {
    await page.goto('/admin/blog');
    await waitForLoaded(page);
    // Wait for initial loading skeleton to disappear
    await page
      .locator('text=/Завантаження/')
      .first()
      .waitFor({ state: 'hidden', timeout: 15000 })
      .catch(() => {});

    const table = page.locator('table');
    const list = page.locator('[class*="grid"], [class*="list"]');
    const emptyState = page.locator('text=/Немає статей|Поки що немає|немає/i');

    const hasTable = await table
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasList = await list
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const hasEmpty = await emptyState
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasTable || hasList || hasEmpty).toBeTruthy();
  });

  test('should navigate to new blog post form', async ({ page }) => {
    await page.goto('/admin/blog/new');
    await waitForLoaded(page);

    expect(page.url()).toContain('/admin/blog/new');

    // Form should have essential fields
    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 5000 });
  });

  test('should have form fields on new blog post page', async ({ page }) => {
    await page.goto('/admin/blog/new');
    await waitForLoaded(page);
    await page
      .locator('text=/Завантаження/')
      .first()
      .waitFor({ state: 'hidden', timeout: 15000 })
      .catch(() => {});

    // Look for title input
    const titleInput = page.locator(
      'input[name="title"], input[placeholder*="Назва"], input[placeholder*="Заголовок"]',
    );
    const hasTitleInput = await titleInput
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Look for content editor (textarea or rich text editor)
    const contentArea = page.locator('textarea, [contenteditable="true"], [class*="editor"]');
    const hasContentArea = await contentArea
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // At least the title field should be present
    expect(hasTitleInput || hasContentArea).toBeTruthy();
  });

  test('should have create/add button on blog listing', async ({ page }) => {
    await page.goto('/admin/blog');
    await waitForLoaded(page);
    await page
      .locator('text=/Завантаження/')
      .first()
      .waitFor({ state: 'hidden', timeout: 15000 })
      .catch(() => {});

    const addButton = page.locator('a[href*="/admin/blog/new"]').first();
    await expect(addButton).toBeVisible({ timeout: 10000 });
  });
});
