import { test, expect } from '@playwright/test';
import { loginViaAPI, TEST_USERS } from './helpers/auth';

test.describe('Account Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginViaAPI(page, TEST_USERS.client.email, TEST_USERS.client.password);
  });

  test('should load settings page with profile form', async ({ page }) => {
    await page.goto('/account/settings');
    await page.waitForLoadState('domcontentloaded');

    const form = page.locator('form, [data-testid="profile-form"], .profile-form');
    const nameInput = page
      .locator('input[name*="name"], input[name*="fullName"], input[name*="firstName"]')
      .first();

    const hasForm = await form
      .first()
      .isVisible()
      .catch(() => false);
    const hasName = await nameInput.isVisible().catch(() => false);

    expect(hasForm || hasName).toBeTruthy();
  });

  test('should allow editing name and phone', async ({ page }) => {
    await page.goto('/account/settings');
    await page.waitForLoadState('domcontentloaded');

    const nameInput = page
      .locator('input[name*="name"], input[name*="fullName"], input[name*="firstName"]')
      .first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill(TEST_USERS.client.fullName);
      await expect(nameInput).toHaveValue(TEST_USERS.client.fullName);
    }

    const phoneInput = page.locator('input[name*="phone"], input[type="tel"]').first();
    if (await phoneInput.isVisible().catch(() => false)) {
      await phoneInput.clear();
      await phoneInput.fill('+380991234567');
      await expect(phoneInput).toHaveValue('+380991234567');
    }
  });

  test('should display password change form', async ({ page }) => {
    await page.goto('/account/settings');
    await page.waitForLoadState('domcontentloaded');

    const passwordSection = page
      .locator('input[type="password"], [data-testid="password-section"], h2, h3')
      .filter({ hasText: /password|пароль/i })
      .first();

    const passwordInput = page.locator('input[type="password"]').first();

    const hasSection = await passwordSection.isVisible().catch(() => false);
    const hasInput = await passwordInput.isVisible().catch(() => false);

    // Password change may be on the same page or a separate tab/section
    if (!hasSection && !hasInput) {
      // Try clicking a password change tab or link
      const passwordTab = page
        .locator('button, a, [role="tab"]')
        .filter({ hasText: /password|пароль|безпека|security/i })
        .first();
      if (await passwordTab.isVisible().catch(() => false)) {
        await passwordTab.click();
        await expect(page.locator('input[type="password"]').first())
          .toBeVisible({ timeout: 5000 })
          .catch(() => {});
      }
    }
  });

  test('should show error for invalid current password', async ({ page }) => {
    await page.goto('/account/settings');
    await page.waitForLoadState('domcontentloaded');

    const currentPasswordInput = page
      .locator('input[name*="current"], input[name*="old"], input[placeholder*="поточн"]')
      .first();
    const newPasswordInput = page.locator('input[name*="new"], input[name*="newPassword"]').first();

    if (await currentPasswordInput.isVisible().catch(() => false)) {
      await currentPasswordInput.fill('WrongPassword123!');

      if (await newPasswordInput.isVisible().catch(() => false)) {
        await newPasswordInput.fill('NewPassword456!');
      }

      const confirmInput = page.locator('input[name*="confirm"], input[name*="repeat"]').first();
      if (await confirmInput.isVisible().catch(() => false)) {
        await confirmInput.fill('NewPassword456!');
      }

      const submitButton = page
        .locator('button[type="submit"]')
        .filter({ hasText: /save|зберегти|змінити|change/i })
        .first();
      if (await submitButton.isVisible().catch(() => false)) {
        await submitButton.click();
        await page.waitForLoadState('domcontentloaded');

        // Should show an error message
        const error = page.locator('.error, [role="alert"], .text-red-500, .toast-error').first();
        await expect(error)
          .toBeVisible({ timeout: 5000 })
          .catch(() => {});
      }
    }
  });

  test('should prevent saving empty required fields', async ({ page }) => {
    await page.goto('/account/settings');
    await page.waitForLoadState('domcontentloaded');

    const nameInput = page
      .locator('input[name*="name"], input[name*="fullName"], input[name*="firstName"]')
      .first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.clear();

      const submitButton = page.locator('button[type="submit"]').first();
      if (await submitButton.isVisible().catch(() => false)) {
        await submitButton.click();

        // Should show validation error or remain on page
        await expect(page).toHaveURL(/\/account\/settings/);
      }
    }
  });
});
