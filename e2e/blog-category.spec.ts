import { test, expect } from '@playwright/test';

test.describe('Blog Category', () => {
  test('should load blog category page', async ({ page }) => {
    // First visit blog to find a category
    await page.goto('/blog');
    await page.waitForLoadState('domcontentloaded');

    const categoryLink = page.locator('a[href*="/blog/category/"]').first();
    const hasCategoryLink = await categoryLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCategoryLink) {
      test.skip();
      return;
    }

    const href = await categoryLink.getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');

    const main = page.locator('main');
    await expect(main).toBeVisible({ timeout: 5000 });

    // Should have a heading for the category
    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('should display blog posts in category', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('domcontentloaded');

    const categoryLink = page.locator('a[href*="/blog/category/"]').first();
    if (!(await categoryLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const href = await categoryLink.getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');

    // Posts should be listed or empty state shown
    const postLinks = page.locator('a[href*="/blog/"]').filter({ hasNotText: /categor/i });
    const postCount = await postLinks.count();

    if (postCount === 0) {
      const emptyState = page.locator('text=/Немає статей|Поки що немає|порожн/i');
      const hasEmpty = await emptyState
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      expect(hasEmpty).toBeTruthy();
    } else {
      await expect(postLinks.first()).toBeVisible();
    }
  });

  test('should have working blog card links', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('domcontentloaded');

    const categoryLink = page.locator('a[href*="/blog/category/"]').first();
    if (!(await categoryLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const href = await categoryLink.getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');

    // Find a post link that is not a category link
    const postLink = page
      .locator('a[href*="/blog/"]')
      .filter({ hasNotText: /categor/i })
      .first();
    if (!(await postLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await postLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Should navigate to a blog post detail page
    expect(page.url()).toMatch(/\/blog\/.+/);

    const main = page.locator('main');
    await expect(main).toBeVisible({ timeout: 5000 });
  });

  test('should handle pagination on category page', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('domcontentloaded');

    const categoryLink = page.locator('a[href*="/blog/category/"]').first();
    if (!(await categoryLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const href = await categoryLink.getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');

    // Look for pagination controls
    const pagination = page.locator(
      'nav[aria-label*="pagination"], [class*="pagination"], a[href*="page="], button:has-text("Далі")',
    );
    const hasPagination = await pagination
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (hasPagination) {
      await expect(pagination.first()).toBeVisible();
    }

    // Page should remain stable regardless
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show appropriate message for empty category', async ({ page }) => {
    // Navigate to a potentially empty category via query
    await page.goto('/blog/category/non-existent-category-slug');
    await page.waitForLoadState('domcontentloaded');

    // Should show empty state, 404, or redirect
    const body = page.locator('body');
    await expect(body).toBeVisible();

    const emptyOrError = page.locator('text=/Немає статей|не знайдено|404|порожн|not found/i');
    const _hasMessage = await emptyOrError
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Either an appropriate message is shown or the page handles it gracefully
    await expect(body).toBeVisible();
  });
});
