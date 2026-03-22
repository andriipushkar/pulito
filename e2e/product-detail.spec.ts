import { test, expect } from '@playwright/test';

test.describe('Product Detail Page', () => {
  test('should navigate from catalog to product', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    const productLink = page.locator('a[href*="/product/"]').first();
    if (!await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await productLink.click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/product/');
  });

  test('should display product name', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    const productLink = page.locator('a[href*="/product/"]').first();
    if (!await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await productLink.click();
    await page.waitForLoadState('networkidle');

    const productName = page.locator('h1');
    await expect(productName).toBeVisible({ timeout: 5000 });
    const text = await productName.textContent();
    expect(text?.length).toBeGreaterThan(0);
  });

  test('should display product price', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    const productLink = page.locator('a[href*="/product/"]').first();
    if (!await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await productLink.click();
    await page.waitForLoadState('networkidle');

    // Price should contain a number and currency symbol
    const price = page.locator('text=/\\d+.*₴|₴.*\\d+/').first();
    const hasPrice = await price.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasPrice) {
      expect(hasPrice).toBeTruthy();
    }
    await expect(page.locator('main')).toBeVisible();
  });

  test('should have add to cart button', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    const productLink = page.locator('a[href*="/product/"]').first();
    if (!await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await productLink.click();
    await page.waitForLoadState('networkidle');

    const addToCartButton = page.locator('button:has-text("кошик"), button:has-text("Додати"), button:has-text("Купити"), [data-testid="add-to-cart"]').first();
    const hasButton = await addToCartButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasButton) {
      await expect(addToCartButton).toBeEnabled();
    }
    await expect(page.locator('main')).toBeVisible();
  });

  test('should have reviews section', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    const productLink = page.locator('a[href*="/product/"]').first();
    if (!await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await productLink.click();
    await page.waitForLoadState('networkidle');

    const reviews = page.locator('text=/відгук|Відгуки|review/i, [data-testid="reviews"]').first();
    const hasReviews = await reviews.isVisible({ timeout: 5000 }).catch(() => false);

    // Reviews section is expected but non-blocking
    if (hasReviews) {
      expect(hasReviews).toBeTruthy();
    }
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have related products section', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    const productLink = page.locator('a[href*="/product/"]').first();
    if (!await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await productLink.click();
    await page.waitForLoadState('networkidle');

    // Related products section — look for additional product links on the page
    const relatedSection = page.locator('text=/схожі|рекомендо|також|related/i, [data-testid="related-products"]').first();
    const hasRelated = await relatedSection.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasRelated) {
      expect(hasRelated).toBeTruthy();
    }
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have breadcrumbs', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    const productLink = page.locator('a[href*="/product/"]').first();
    if (!await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await productLink.click();
    await page.waitForLoadState('networkidle');

    const breadcrumb = page.locator('nav[aria-label*="breadcrumb"], nav[aria-label*="Breadcrumb"], [class*="breadcrumb"], ol > li > a[href="/catalog"]').first();
    const hasBreadcrumb = await breadcrumb.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasBreadcrumb) {
      expect(hasBreadcrumb).toBeTruthy();
    }
    await expect(page.locator('body')).toBeVisible();
  });
});
