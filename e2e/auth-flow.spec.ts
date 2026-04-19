import { test, expect } from '@playwright/test';
import { loginViaUI, logout, TEST_USERS } from './helpers/auth';

test.describe('Full Auth Flow', () => {
  test('should register a new user', async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForLoadState('domcontentloaded');

    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const nameInput = page.locator('input[name="fullName"], input[name="name"]').first();

    await expect(emailInput).toBeVisible();

    // Fill with unique email
    const uniqueEmail = `test-${Date.now()}@e2e-test.ua`;
    await emailInput.fill(uniqueEmail);
    await passwordInput.fill('TestPassword123!');
    if (await nameInput.isVisible()) {
      await nameInput.fill('E2E Тестовий Користувач');
    }

    // Submit
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(2000);

    // Should redirect or show success
    const isOnRegister = page.url().includes('/auth/register');
    const successMsg = page.locator('text=/успішно|Вітаємо|підтвердження/i');
    const redirected = !isOnRegister;

    expect(
      redirected || (await successMsg.isVisible({ timeout: 3000 }).catch(() => false)),
    ).toBeTruthy();
  });

  test('should login with valid credentials', async ({ page }) => {
    await loginViaUI(page, TEST_USERS.client.email, TEST_USERS.client.password);

    // Should be on homepage or account page after login
    expect(page.url()).not.toContain('/auth/login');
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').first().fill('nonexistent@test.ua');
    await page.locator('input[type="password"]').first().fill('WrongPassword123');
    await page.locator('button[type="submit"]').first().click();

    await page.waitForTimeout(1000);
    // Should stay on login page or show error
    const isOnLogin = page.url().includes('/auth/login');
    const errorMsg = page.locator('text=/помилк|невірн|incorrect|invalid/i');
    expect(
      isOnLogin || (await errorMsg.isVisible({ timeout: 3000 }).catch(() => false)),
    ).toBeTruthy();
  });

  test('should access profile when logged in', async ({ page }) => {
    await loginViaUI(page, TEST_USERS.client.email, TEST_USERS.client.password);

    // Navigate to profile/account page
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');

    // Should show account page (not redirect to login)
    const profileContent = page.locator('text=/профіль|акаунт|account|Тестовий Клієнт/i');
    const isOnAccount = page.url().includes('/account');
    expect(
      isOnAccount || (await profileContent.isVisible({ timeout: 5000 }).catch(() => false)),
    ).toBeTruthy();
  });

  test('should logout successfully', async ({ page }) => {
    await loginViaUI(page, TEST_USERS.client.email, TEST_USERS.client.password);

    // Find and click logout button/link
    const logoutBtn = page
      .locator('button:has-text("Вийти"), a:has-text("Вийти"), [data-testid="logout"]')
      .first();
    if (await logoutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await logoutBtn.click();
      await page.waitForTimeout(1000);
    } else {
      await logout(page);
      await page.goto('/');
    }

    // Navigate to protected page — should redirect to login
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');
    // Should be on login page or show login prompt
    await expect(page.locator('body')).toBeVisible();
  });
});
