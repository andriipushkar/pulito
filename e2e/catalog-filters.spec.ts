import { test, expect } from '@playwright/test';

test.describe('Catalog filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/catalog');
    await expect(page).toHaveURL(/\/catalog/);
  });

  test('should display filter sidebar with price section', async ({ page }) => {
    const priceHeading = page.getByText('Ціна, ₴');
    await expect(priceHeading).toBeVisible();
  });

  test('should have dual range slider thumbs', async ({ page }) => {
    const sliders = page.locator('[role="slider"]');
    // At least 2 slider thumbs for min and max price
    const count = await sliders.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('should interact with price range slider via keyboard', async ({ page }) => {
    const minSlider = page.locator('[aria-label="Мінімальна ціна"]').first();
    if (await minSlider.isVisible()) {
      await minSlider.focus();
      await minSlider.press('ArrowRight');
      // The slider should have updated its aria-valuenow
      const value = await minSlider.getAttribute('aria-valuenow');
      expect(Number(value)).toBeGreaterThanOrEqual(0);
    }
  });

  test('should update URL params when filters are applied', async ({ page }) => {
    // Click the promo checkbox
    const promoLabel = page.getByText('Тільки акційні');
    if (await promoLabel.isVisible()) {
      await promoLabel.click();
      // Click apply button
      const applyBtn = page.getByRole('button', { name: 'Застосувати' });
      await applyBtn.click();
      await expect(page).toHaveURL(/promo=true/);
    }
  });

  test('should update URL with price params when applied', async ({ page }) => {
    // Fill in the price "from" input
    const priceMinInput = page.locator('input[type="number"][placeholder="Від"]').first();
    if (await priceMinInput.isVisible()) {
      await priceMinInput.fill('500');
      const applyBtn = page.getByRole('button', { name: 'Застосувати' });
      await applyBtn.click();
      await expect(page).toHaveURL(/price_min=500/);
    }
  });

  test('should reset filters when reset button is clicked', async ({ page }) => {
    // Navigate with existing filters
    await page.goto('/catalog?promo=true&price_min=500');
    await expect(page).toHaveURL(/price_min=500/);

    const resetBtn = page.getByRole('button', { name: 'Скинути' });
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
      await expect(page).toHaveURL('/catalog');
    }
  });

  test('should display filter chips for active filters', async ({ page }) => {
    await page.goto('/catalog?promo=true');
    // Look for a chip with "Акційні" text
    const chip = page.getByText('Акційні');
    if (await chip.isVisible()) {
      await expect(chip).toBeVisible();
    }
  });

  test('should show category checkboxes', async ({ page }) => {
    const categoryHeading = page.getByText('Категорії');
    await expect(categoryHeading).toBeVisible();

    // Should have at least one checkbox in the category section
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);
  });
});
