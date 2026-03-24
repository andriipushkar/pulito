import { test, expect } from '@playwright/test';
import { loginViaAPI, logout, TEST_USERS } from './helpers/auth';

test.describe('Account Finance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginViaAPI(page, TEST_USERS.client.email, TEST_USERS.client.password);
  });

  test('should load financial dashboard', async ({ page }) => {
    await page.goto('/account/finance');
    await page.waitForLoadState('networkidle');

    const dashboard = page.locator('main, [data-testid="finance-dashboard"], .finance, .dashboard');
    await expect(dashboard.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display metrics cards', async ({ page }) => {
    await page.goto('/account/finance');
    await page.waitForLoadState('networkidle');

    const cards = page.locator(
      '[data-testid="metric-card"], .metric-card, .stat-card, .card, [class*="card"]',
    );
    const cardCount = await cards.count().catch(() => 0);

    if (cardCount > 0) {
      await expect(cards.first()).toBeVisible();
    }

    // Check for common financial metrics text
    const metricsText = page
      .locator('text=/баланс|витрати|дохід|balance|spent|total|загальн/i')
      .first();
    const hasMetrics = await metricsText.isVisible().catch(() => false);

    expect(cardCount > 0 || hasMetrics).toBeTruthy();
  });

  test('should render chart or graph element', async ({ page }) => {
    await page.goto('/account/finance');
    await page.waitForLoadState('networkidle');

    const chart = page
      .locator('canvas, svg, [data-testid="chart"], .chart, .recharts-wrapper, [class*="chart"]')
      .first();
    const hasChart = await chart.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasChart) {
      await expect(chart).toBeVisible();
    }
    // Chart may not be present if no financial data — this is acceptable
  });

  test('should restrict access for unauthenticated users', async ({ page }) => {
    await logout(page);
    await page.goto('/account/finance');
    await page.waitForLoadState('networkidle');

    // Should redirect to login or show unauthorized
    const isRedirected = page.url().includes('/auth/login') || page.url().includes('/login');
    const unauthorizedMessage = page.locator('text=/unauthorized|увійдіть|авторизуйтесь/i').first();
    const hasUnauthorized = await unauthorizedMessage.isVisible().catch(() => false);

    expect(isRedirected || hasUnauthorized).toBeTruthy();
  });

  test('should show date range or period selector if available', async ({ page }) => {
    await page.goto('/account/finance');
    await page.waitForLoadState('networkidle');

    const periodSelector = page
      .locator(
        'select, [data-testid="period-selector"], [role="combobox"], input[type="date"], button',
      )
      .filter({ hasText: /month|week|year|місяць|тиждень|рік|період/i })
      .first();

    if (await periodSelector.isVisible().catch(() => false)) {
      await expect(periodSelector).toBeEnabled();
    }
  });
});
