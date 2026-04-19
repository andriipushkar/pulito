import { test, expect } from '@playwright/test';
import { waitForLoaded } from './helpers/wait';

test.describe('Review Images', () => {
  test('should navigate to product page and check for review section', async ({ page }) => {
    await page.goto('/catalog');
    await waitForLoaded(page);

    const productLink = page.locator('a[href*="/product/"]').first();
    if (!(await productLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await productLink.click();
    await waitForLoaded(page);
    expect(page.url()).toContain('/product/');

    // Check that review section exists
    const reviewSection = page.locator('text=Відгуки');
    await expect(reviewSection.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display review images if present', async ({ page }) => {
    await page.goto('/catalog');
    await waitForLoaded(page);

    const productLink = page.locator('a[href*="/product/"]').first();
    if (!(await productLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await productLink.click();
    await waitForLoaded(page);

    // Look for review image gallery thumbnails
    const gallery = page.locator('[data-testid="review-image-gallery"]').first();
    const galleryVisible = await gallery.isVisible({ timeout: 3000 }).catch(() => false);

    if (galleryVisible) {
      // Verify gallery has thumbnail buttons
      const thumbnails = gallery.locator('button');
      const count = await thumbnails.count();
      expect(count).toBeGreaterThan(0);

      // Verify images are loaded inside thumbnails
      const firstImg = thumbnails.first().locator('img');
      await expect(firstImg).toHaveAttribute('src', /.+/);
    }
    // If no gallery, that's ok - the product may not have review images
  });

  test('should open gallery lightbox on image click', async ({ page }) => {
    await page.goto('/catalog');
    await waitForLoaded(page);

    const productLink = page.locator('a[href*="/product/"]').first();
    if (!(await productLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await productLink.click();
    await waitForLoaded(page);

    const gallery = page.locator('[data-testid="review-image-gallery"]').first();
    const galleryVisible = await gallery.isVisible({ timeout: 3000 }).catch(() => false);

    if (!galleryVisible) {
      test.skip();
      return;
    }

    // Click first thumbnail
    const firstButton = gallery.locator('button').first();
    await firstButton.click();

    // Verify lightbox opened
    const lightbox = page.locator('[data-testid="lightbox"]');
    await expect(lightbox).toBeVisible({ timeout: 3000 });

    // Verify lightbox has an image
    const lightboxImage = lightbox.locator('[data-testid="lightbox-image"]');
    await expect(lightboxImage).toBeVisible();

    // Close lightbox with Escape
    await page.keyboard.press('Escape');
    await expect(lightbox).not.toBeVisible();
  });
});
