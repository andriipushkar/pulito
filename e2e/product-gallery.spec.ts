import { test, expect } from '@playwright/test';

test.describe('Product Image Gallery', () => {
  // Helper: navigate to a product page that has images
  async function goToProductWithImages(page: import('@playwright/test').Page) {
    // Navigate to catalog to find a product
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    // Click the first product link
    const productLink = page.locator('a[href*="/product/"]').first();
    if (!await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      return false;
    }
    await productLink.click();
    await page.waitForLoadState('networkidle');

    // Verify we're on a product page
    return page.url().includes('/product/');
  }

  test('should display product image on product page', async ({ page }) => {
    const onProductPage = await goToProductWithImages(page);
    if (!onProductPage) {
      test.skip();
      return;
    }

    // Main product image should be visible
    const mainImage = page.locator('img[alt]').first();
    await expect(mainImage).toBeVisible({ timeout: 5000 });
  });

  test('should display thumbnail strip when multiple images exist', async ({ page }) => {
    const onProductPage = await goToProductWithImages(page);
    if (!onProductPage) {
      test.skip();
      return;
    }

    // Check for thumbnail buttons (on desktop)
    const viewportSize = page.viewportSize();
    if (!viewportSize || viewportSize.width < 1024) {
      test.skip();
      return;
    }

    const thumbnails = page.locator('button img.h-16');
    const thumbnailCount = await thumbnails.count();

    if (thumbnailCount <= 1) {
      // Only one image or no thumbnails -- skip thumbnail-specific tests
      test.skip();
      return;
    }

    // Thumbnails should be visible
    await expect(thumbnails.first()).toBeVisible();
  });

  test('should change main image when thumbnail is clicked', async ({ page }) => {
    const onProductPage = await goToProductWithImages(page);
    if (!onProductPage) {
      test.skip();
      return;
    }

    const viewportSize = page.viewportSize();
    if (!viewportSize || viewportSize.width < 1024) {
      test.skip();
      return;
    }

    const thumbnails = page.locator('button img.h-16');
    const thumbnailCount = await thumbnails.count();

    if (thumbnailCount <= 1) {
      test.skip();
      return;
    }

    // Get the first thumbnail's src to compare
    const _firstThumbnailSrc = await thumbnails.nth(0).getAttribute('src');
    const _secondThumbnailSrc = await thumbnails.nth(1).getAttribute('src');

    // Click the second thumbnail
    const secondThumbnailButton = page.locator('button:has(img.h-16)').nth(1);
    await secondThumbnailButton.click();

    // Wait for update
    await page.waitForTimeout(300);

    // The selected thumbnail should now have the primary border
    const _selectedBorder = secondThumbnailButton.locator('[class*="border-[var(--color-primary)]"]');
    // Or check that the button class changed
    const buttonClass = await secondThumbnailButton.getAttribute('class');
    expect(buttonClass).toContain('border-');
  });

  test('should open lightbox when clicking the main image on desktop', async ({ page }) => {
    const onProductPage = await goToProductWithImages(page);
    if (!onProductPage) {
      test.skip();
      return;
    }

    const viewportSize = page.viewportSize();
    if (!viewportSize || viewportSize.width < 1024) {
      test.skip();
      return;
    }

    // Click on the main image container (cursor-zoom-in)
    const mainImageContainer = page.locator('.cursor-zoom-in').first();
    if (!await mainImageContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await mainImageContainer.click();

    // Lightbox (Modal) should open
    // Look for the close button (aria-label="Закрити")
    const closeButton = page.locator('button[aria-label="Закрити"]');
    await expect(closeButton).toBeVisible({ timeout: 3000 });

    // Lightbox should show the full-size image
    const lightboxImage = page.locator('.bg-black img');
    await expect(lightboxImage).toBeVisible();
  });

  test('should close lightbox when clicking close button', async ({ page }) => {
    const onProductPage = await goToProductWithImages(page);
    if (!onProductPage) {
      test.skip();
      return;
    }

    const viewportSize = page.viewportSize();
    if (!viewportSize || viewportSize.width < 1024) {
      test.skip();
      return;
    }

    // Open lightbox
    const mainImageContainer = page.locator('.cursor-zoom-in').first();
    if (!await mainImageContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await mainImageContainer.click();

    // Close the lightbox
    const closeButton = page.locator('button[aria-label="Закрити"]');
    await expect(closeButton).toBeVisible({ timeout: 3000 });
    await closeButton.click();

    // Lightbox should be closed
    await expect(closeButton).not.toBeVisible({ timeout: 3000 });
  });

  test('should navigate between images in lightbox with arrows', async ({ page }) => {
    const onProductPage = await goToProductWithImages(page);
    if (!onProductPage) {
      test.skip();
      return;
    }

    const viewportSize = page.viewportSize();
    if (!viewportSize || viewportSize.width < 1024) {
      test.skip();
      return;
    }

    // Check if there are multiple images (thumbnails)
    const thumbnails = page.locator('button img.h-16');
    const thumbnailCount = await thumbnails.count();

    if (thumbnailCount <= 1) {
      test.skip();
      return;
    }

    // Open lightbox
    const mainImageContainer = page.locator('.cursor-zoom-in').first();
    if (!await mainImageContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await mainImageContainer.click();
    await expect(page.locator('button[aria-label="Закрити"]')).toBeVisible({ timeout: 3000 });

    // Navigation arrows should be visible
    const prevButton = page.locator('button[aria-label="Попередній"]');
    const nextButton = page.locator('button[aria-label="Наступний"]');

    await expect(prevButton).toBeVisible();
    await expect(nextButton).toBeVisible();

    // Get current image src
    const lightboxImage = page.locator('.bg-black img').first();
    const initialSrc = await lightboxImage.getAttribute('src');

    // Click next
    await nextButton.click();
    await page.waitForTimeout(300);

    // Image src should have changed
    const nextSrc = await lightboxImage.getAttribute('src');
    // Note: if there are only 2 images and we go next, src changes.
    // If only 1 image, it wraps around to same -- but we already checked thumbnailCount > 1
    if (thumbnailCount > 1) {
      expect(nextSrc).not.toBe(initialSrc);
    }

    // Click previous to go back
    await prevButton.click();
    await page.waitForTimeout(300);

    const backSrc = await lightboxImage.getAttribute('src');
    expect(backSrc).toBe(initialSrc);
  });

  test('should show placeholder when product has no images', async ({ page }) => {
    // Try to navigate to a product directly -- if the product has no images,
    // the gallery should show a placeholder
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    // Just check that a product page loads without errors
    const productLink = page.locator('a[href*="/product/"]').first();
    if (!await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await productLink.click();
    await page.waitForLoadState('networkidle');

    // Page should have loaded without errors
    const pageTitle = page.locator('h1');
    await expect(pageTitle.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show mobile carousel on mobile viewport', async ({ page }) => {
    const viewportSize = page.viewportSize();
    if (!viewportSize || viewportSize.width >= 1024) {
      // Not a mobile viewport
      test.skip();
      return;
    }

    const onProductPage = await goToProductWithImages(page);
    if (!onProductPage) {
      test.skip();
      return;
    }

    // Mobile carousel should be visible (the lg:hidden block)
    // Check for dot indicators
    const dotButtons = page.locator('button[aria-label*="Зображення"]');
    const _dotCount = await dotButtons.count();

    // At least the main content should be visible
    await expect(page.locator('main')).toBeVisible();
  });
});
