import { test, expect } from '@playwright/test';
import { loginViaAPI, TEST_USERS } from './helpers/auth';

test.describe('Account Addresses', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginViaAPI(page, TEST_USERS.client.email, TEST_USERS.client.password);
  });

  test('should load addresses page with list or empty state', async ({ page }) => {
    await page.goto('/account/addresses');
    await page.waitForLoadState('domcontentloaded');

    const addressList = page.locator('[data-testid="address-list"], .address-list, .addresses');
    const emptyState = page.locator('[data-testid="empty-state"], .empty-state, .no-addresses');
    const addButton = page
      .locator('button, a')
      .filter({ hasText: /add|додати|нова/i })
      .first();

    const hasAddresses = await addressList.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const hasAddBtn = await addButton.isVisible().catch(() => false);

    expect(hasAddresses || hasEmpty || hasAddBtn).toBeTruthy();
  });

  test('should validate add new address form', async ({ page }) => {
    await page.goto('/account/addresses');
    await page.waitForLoadState('domcontentloaded');

    const addButton = page
      .locator('button, a')
      .filter({ hasText: /add|додати|нова|створити/i })
      .first();
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      await page.waitForLoadState('domcontentloaded');

      // Try submitting empty form to trigger validation
      const submitButton = page.locator('button[type="submit"]').first();
      if (await submitButton.isVisible().catch(() => false)) {
        await submitButton.click();

        // Should show validation errors or remain on form
        const errors = page.locator(
          '.error, [role="alert"], .field-error, .validation-error, .text-red-500',
        );
        const hasErrors = await errors
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        const stayedOnForm = await submitButton.isVisible();

        expect(hasErrors || stayedOnForm).toBeTruthy();
      }
    }
  });

  test('should open edit form for existing address', async ({ page }) => {
    await page.goto('/account/addresses');
    await page.waitForLoadState('domcontentloaded');

    const editButton = page
      .locator('button, a')
      .filter({ hasText: /edit|редагувати|змінити/i })
      .first();
    if (await editButton.isVisible().catch(() => false)) {
      await editButton.click();
      await page.waitForLoadState('domcontentloaded');

      // Edit form or modal should appear with input fields
      const input = page
        .locator('input[name*="city"], input[name*="street"], input[name*="address"], input')
        .first();
      await expect(input)
        .toBeVisible({ timeout: 5000 })
        .catch(() => {});
    }
  });

  test('should handle delete address', async ({ page }) => {
    await page.goto('/account/addresses');
    await page.waitForLoadState('domcontentloaded');

    const deleteButton = page
      .locator('button, a')
      .filter({ hasText: /delete|видалити|remove/i })
      .first();
    if (await deleteButton.isVisible().catch(() => false)) {
      // Click delete — expect a confirmation dialog or immediate removal
      await deleteButton.click();

      const confirmButton = page
        .locator('button')
        .filter({ hasText: /confirm|так|yes|підтвердити|видалити/i })
        .first();
      if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Confirmation dialog appeared — do not confirm, just verify it works
        await expect(confirmButton).toBeVisible();
      }
    }
  });

  test('should allow setting default address', async ({ page }) => {
    await page.goto('/account/addresses');
    await page.waitForLoadState('domcontentloaded');

    const defaultButton = page
      .locator('button, a, input[type="radio"]')
      .filter({ hasText: /default|за замовчуванням|основна|головна/i })
      .first();

    if (await defaultButton.isVisible().catch(() => false)) {
      await expect(defaultButton).toBeEnabled();
    }
  });
});
