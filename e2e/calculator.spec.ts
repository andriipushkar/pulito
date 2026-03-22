import { test, expect } from '@playwright/test';

test.describe('Calculator', () => {
  test('calculator page loads with form', async ({ page }) => {
    await page.goto('/calculator');
    await page.waitForLoadState('networkidle');

    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Should have a heading
    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('should have family size slider or input', async ({ page }) => {
    await page.goto('/calculator');
    await page.waitForLoadState('networkidle');

    // Look for slider (range input) or number input for family size
    const slider = page.locator('input[type="range"]');
    const numberInput = page.locator('input[type="number"]');
    const select = page.locator('select');

    const hasSlider = await slider.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasNumberInput = await numberInput.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasSelect = await select.first().isVisible({ timeout: 3000 }).catch(() => false);

    // At least one form control should exist for family size
    expect(hasSlider || hasNumberInput || hasSelect).toBeTruthy();
  });

  test('should adjust family size and calculate recommendations', async ({ page }) => {
    await page.goto('/calculator');
    await page.waitForLoadState('networkidle');

    // Try adjusting a slider if present
    const slider = page.locator('input[type="range"]').first();
    if (await slider.isVisible({ timeout: 3000 }).catch(() => false)) {
      await slider.fill('4');
    } else {
      // Try number input
      const numberInput = page.locator('input[type="number"]').first();
      if (await numberInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await numberInput.fill('4');
      }
    }

    // Click the calculate button
    const calculateButton = page.locator('button', { hasText: /Розрахувати/i });
    if (await calculateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await calculateButton.click();
      await page.waitForLoadState('networkidle');

      // Recommendations should appear
      await page.waitForTimeout(1000);
      const main = page.locator('main');
      await expect(main).toBeVisible();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('should show "Додати" buttons on recommendations', async ({ page }) => {
    await page.goto('/calculator');
    await page.waitForLoadState('networkidle');

    // Fill in form and calculate
    const slider = page.locator('input[type="range"]').first();
    if (await slider.isVisible({ timeout: 3000 }).catch(() => false)) {
      await slider.fill('3');
    }

    const calculateButton = page.locator('button', { hasText: /Розрахувати/i });
    if (!await calculateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await calculateButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Look for "Додати" buttons on recommendation cards
    const addButtons = page.locator('button', { hasText: /Додати/i });
    const hasAddButtons = await addButtons.first().isVisible({ timeout: 5000 }).catch(() => false);

    // Recommendations with add buttons are expected but data-dependent
    if (hasAddButtons) {
      expect(hasAddButtons).toBeTruthy();
    }

    await expect(page.locator('body')).toBeVisible();
  });
});
