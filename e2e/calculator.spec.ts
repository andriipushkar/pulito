import { test, expect } from '@playwright/test';

test.describe('Calculator', () => {
  test('calculator page loads with step 1 form', async ({ page }) => {
    await page.goto('/calculator');
    await page.waitForLoadState('domcontentloaded');

    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 5000 });
    await expect(heading).toContainText('Калькулятор');

    // Step 1 should be visible
    const step1 = page.locator('[data-testid="step-1"]');
    await expect(step1).toBeVisible({ timeout: 5000 });
  });

  test('step 1: should have family size slider and cleaning frequency options', async ({
    page,
  }) => {
    await page.goto('/calculator');
    await page.waitForLoadState('domcontentloaded');

    // Family size slider
    const slider = page.locator('input[type="range"]').first();
    await expect(slider).toBeVisible({ timeout: 5000 });

    // Cleaning frequency buttons
    await expect(page.locator('button', { hasText: 'Щодня' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Раз на тиждень' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Раз на 2 тижні' })).toBeVisible();
  });

  test('should navigate from step 1 to step 2 (room selection)', async ({ page }) => {
    await page.goto('/calculator');
    await page.waitForLoadState('domcontentloaded');

    // Fill step 1 — adjust family size
    const slider = page.locator('input[type="range"]').first();
    if (await slider.isVisible({ timeout: 3000 }).catch(() => false)) {
      await slider.fill('4');
    }

    // Click "Розрахувати" (the form submit button in step 1)
    const submitButton = page.locator('button[type="submit"]', { hasText: /Розрахувати/i });
    await expect(submitButton).toBeVisible({ timeout: 3000 });
    await submitButton.click();

    // Step 2 should appear
    const step2 = page.locator('[data-testid="step-2"]');
    await expect(step2).toBeVisible({ timeout: 5000 });

    // Room selection cards should be visible
    await expect(page.locator('[data-testid="room-option-kitchen"]')).toBeVisible();
    await expect(page.locator('[data-testid="room-option-bathroom"]')).toBeVisible();
    await expect(page.locator('[data-testid="room-option-bedroom"]')).toBeVisible();
  });

  test('should select rooms and see configuration inputs', async ({ page }) => {
    await page.goto('/calculator');
    await page.waitForLoadState('domcontentloaded');

    // Move to step 2
    const submitButton = page.locator('button[type="submit"]', { hasText: /Розрахувати/i });
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();
    await expect(page.locator('[data-testid="step-2"]')).toBeVisible({ timeout: 5000 });

    // Select kitchen
    await page.locator('[data-testid="room-option-kitchen"]').click();
    await expect(page.locator('[data-testid="room-config-kitchen"]')).toBeVisible();

    // Select bathroom
    await page.locator('[data-testid="room-option-bathroom"]').click();
    await expect(page.locator('[data-testid="room-config-bathroom"]')).toBeVisible();

    // Summary should show 2 rooms
    const summary = page.locator('[data-testid="room-summary"]');
    await expect(summary).toContainText('Обрано 2 кімнати');
  });

  test('full flow: step 1 → step 2 → step 3 results', async ({ page }) => {
    await page.goto('/calculator');
    await page.waitForLoadState('domcontentloaded');

    // Step 1: fill household info
    const slider = page.locator('input[type="range"]').first();
    if (await slider.isVisible({ timeout: 3000 }).catch(() => false)) {
      await slider.fill('3');
    }

    const submitButton = page.locator('button[type="submit"]', { hasText: /Розрахувати/i });
    await expect(submitButton).toBeVisible({ timeout: 3000 });
    await submitButton.click();

    // Step 2: select rooms
    await expect(page.locator('[data-testid="step-2"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="room-option-kitchen"]').click();
    await page.locator('[data-testid="room-option-living_room"]').click();

    // Click calculate
    const calcButton = page.locator('button', { hasText: /Розрахувати/i });
    await expect(calcButton).toBeVisible({ timeout: 3000 });
    await calcButton.click();

    // Step 3 should appear with results
    const step3 = page.locator('[data-testid="step-3"]');
    await expect(step3).toBeVisible({ timeout: 10000 });

    // Total cost summary should be visible
    await expect(page.locator('[data-testid="total-cost"]')).toBeVisible({ timeout: 5000 });
  });

  test('should navigate back from step 2 to step 1', async ({ page }) => {
    await page.goto('/calculator');
    await page.waitForLoadState('domcontentloaded');

    // Go to step 2
    const submitButton = page.locator('button[type="submit"]', { hasText: /Розрахувати/i });
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();
    await expect(page.locator('[data-testid="step-2"]')).toBeVisible({ timeout: 5000 });

    // Click back
    const backButton = page.locator('button', { hasText: 'Назад' });
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Step 1 should be visible again
    await expect(page.locator('[data-testid="step-1"]')).toBeVisible({ timeout: 5000 });
  });

  test('should show "Додати все в кошик" button in results', async ({ page }) => {
    await page.goto('/calculator');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to step 3
    const submitButton = page.locator('button[type="submit"]', { hasText: /Розрахувати/i });
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();
    await expect(page.locator('[data-testid="step-2"]')).toBeVisible({ timeout: 5000 });

    await page.locator('[data-testid="room-option-kitchen"]').click();

    const calcButton = page.locator('button', { hasText: /Розрахувати/i });
    await calcButton.click();

    const step3 = page.locator('[data-testid="step-3"]');
    await expect(step3).toBeVisible({ timeout: 10000 });

    // Add-all-to-cart button should be present
    const addAllBtn = page.locator('[data-testid="add-all-to-cart"]');
    await expect(addAllBtn).toBeVisible({ timeout: 5000 });
  });
});
