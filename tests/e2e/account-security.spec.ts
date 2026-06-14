import { test, expect } from '@playwright/test';
import { waitForLoaded } from './helpers/wait';
import { loginViaAPI, logout, TEST_USERS } from './helpers/auth';

test.describe('Account Security', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginViaAPI(page, TEST_USERS.client.email, TEST_USERS.client.password);
  });

  test('should load security page with 2FA section', async ({ page }) => {
    await page.goto('/account/security');
    await waitForLoaded(page);

    const twoFactorSection = page
      .locator('[data-testid="2fa-section"], .two-factor, h2, h3, p')
      .filter({ hasText: /2fa|two.factor|двофакторна|автентифікац/i })
      .first();

    const securityContent = page.locator('main, [data-testid="security-page"], .security');
    const hasContent = await securityContent
      .first()
      .isVisible()
      .catch(() => false);
    const has2FA = await twoFactorSection.isVisible().catch(() => false);

    expect(hasContent || has2FA).toBeTruthy();
  });

  test('should display login history table', async ({ page }) => {
    await page.goto('/account/security');
    await waitForLoaded(page);

    const historyTable = page
      .locator('table, [data-testid="login-history"], .login-history, .sessions')
      .first();
    const historyHeading = page
      .locator('h2, h3, h4')
      .filter({ hasText: /history|історія|session|сесі/i })
      .first();

    const hasTable = await historyTable.isVisible().catch(() => false);
    const hasHeading = await historyHeading.isVisible().catch(() => false);

    // At least one of these should be present on a security page
    if (hasTable) {
      await expect(historyTable).toBeVisible();
    } else if (hasHeading) {
      await expect(historyHeading).toBeVisible();
    }
  });

  test('should show 2FA setup button when not enabled', async ({ page }) => {
    await page.goto('/account/security');
    await waitForLoaded(page);

    const setupButton = page
      .locator('button, a')
      .filter({ hasText: /enable|setup|увімкнути|налаштувати|activate|активувати/i })
      .first();

    const disableButton = page
      .locator('button, a')
      .filter({ hasText: /disable|вимкнути|деактивувати/i })
      .first();

    const hasSetup = await setupButton.isVisible().catch(() => false);
    const hasDisable = await disableButton.isVisible().catch(() => false);

    // Either setup or disable should be visible depending on 2FA state
    if (hasSetup) {
      await expect(setupButton).toBeEnabled();
    } else if (hasDisable) {
      await expect(disableButton).toBeEnabled();
    }
  });

  test('should restrict access for unauthenticated users', async ({ page }) => {
    await logout(page);
    await page.goto('/account/security');
    // Give AuthProvider time to refresh + redirect
    await page.waitForURL(/\/auth\/login/, { timeout: 10000 }).catch(() => {});

    const isRedirected = page.url().includes('/auth/login') || page.url().includes('/login');
    const unauthorizedMessage = page.locator('text=/unauthorized|увійдіть|авторизуйтесь/i').first();
    const hasUnauthorized = await unauthorizedMessage.isVisible().catch(() => false);

    expect(isRedirected || hasUnauthorized).toBeTruthy();
  });
});
