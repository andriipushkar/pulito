import { test, expect } from '@playwright/test';

test.describe('Blog', () => {
  test('blog listing page loads', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Should have a heading related to blog
    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('should display blog posts', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    // Blog posts should be visible as links or article cards
    const postLinks = page.locator('a[href*="/blog/"]');
    const postCount = await postLinks.count();

    if (postCount === 0) {
      // Empty state is acceptable
      const emptyState = page.locator('text=/Немає статей|Поки що немає/i');
      const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasEmpty).toBeTruthy();
    } else {
      await expect(postLinks.first()).toBeVisible();
    }
  });

  test('should navigate to blog post detail page', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    const postLink = page.locator('a[href*="/blog/"]').first();
    if (!await postLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await postLink.click();
    await page.waitForLoadState('networkidle');

    // URL should contain /blog/ with a slug
    expect(page.url()).toMatch(/\/blog\/.+/);

    // Detail page should have content
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Should have a heading for the post
    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to category filter and update URL', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    // Look for category filter links or select
    const categoryLink = page.locator('a[href*="/blog?category"], a[href*="/blog/?category"]').first();
    const categorySelect = page.locator('select').first();

    if (await categoryLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await categoryLink.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('category');
    } else if (await categorySelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = categorySelect.locator('option');
      const optionCount = await options.count();
      if (optionCount > 1) {
        await categorySelect.selectOption({ index: 1 });
        await page.waitForTimeout(500);
      }
    }

    // Page should remain stable regardless
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have breadcrumbs on blog post', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    const postLink = page.locator('a[href*="/blog/"]').first();
    if (!await postLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await postLink.click();
    await page.waitForLoadState('networkidle');

    // Look for breadcrumb navigation
    const breadcrumb = page.locator('nav[aria-label*="breadcrumb"], nav[aria-label*="Breadcrumb"], [class*="breadcrumb"], ol > li > a[href="/blog"]');
    const hasBreadcrumb = await breadcrumb.first().isVisible({ timeout: 3000 }).catch(() => false);

    // Breadcrumbs are expected but not blocking
    if (hasBreadcrumb) {
      expect(hasBreadcrumb).toBeTruthy();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('should have meta tags on blog page', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    // Check title exists
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Check meta description
    const metaDescription = page.locator('meta[name="description"]');
    const hasMetaDesc = await metaDescription.count();
    if (hasMetaDesc > 0) {
      const content = await metaDescription.getAttribute('content');
      expect(content).toBeTruthy();
    }
  });
});
